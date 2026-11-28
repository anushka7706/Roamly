/* global L */

// Start on Bhopal
const map = L.map("map").setView([23.2599, 77.4126], 13);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
}).addTo(map);

const statusEl = document.getElementById("location-status");
const button = document.getElementById("location-btn");

let marker = null;
let circle = null;
let watchId = null;
// Remember the starting point of the exploration
let explorationOrigin = null;
let explorationMode = null;

function setStatus(text) {
  if (statusEl) statusEl.textContent = text;
}

function showPosition(pos) {
  const lat = pos.coords.latitude;
  const lng = pos.coords.longitude;
  const accuracy = pos.coords.accuracy;
  explorationOrigin = {
    lat: lat,
    lng: lng
};

explorationMode = "current";

  if (!marker) {
    marker = L.marker([lat, lng]).addTo(map).bindPopup("You are here");
    circle = L.circle([lat, lng], { radius: accuracy }).addTo(map);
    map.flyTo([lat, lng], 16); // fly only the first time
  } else {
    marker.setLatLng([lat, lng]);

    if (!circle) {
        circle = L.circle([lat, lng], { radius: accuracy }).addTo(map);
    } else {
        circle.setLatLng([lat, lng]).setRadius(accuracy);
    }
}
  setStatus("Location found (accuracy about " + Math.round(accuracy) + " m)");
  
  findNearbyPlaces(lat, lng);
}

function showError(err) {
  if (err.code === 1) setStatus("Location permission denied. Allow it in your browser settings.");
  else if (err.code === 2) setStatus("Location unavailable. Check GPS or internet.");
  else setStatus("Location request timed out.");
  watchId = null;
}

if (button) {
  button.addEventListener("click", () => {
    if (!("geolocation" in navigator)) {
      setStatus("Your browser does not support location.");
      return;
    }
    if (watchId !== null) {
      // already tracking, just fly back to the marker
      if (marker) map.flyTo(marker.getLatLng(), 16);
      return;
    }
    setStatus("Finding your location...");
    watchId = navigator.geolocation.watchPosition(showPosition, showError, {
      enableHighAccuracy: true,
      maximumAge: 5000,
      timeout: 10000,
    });
  });
}

const searchBtn = document.getElementById("search-btn");
const cityInput = document.getElementById("city-input");

if (searchBtn) {
    searchBtn.addEventListener("click", searchLocation);
}

if (cityInput) {
    cityInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
            searchLocation();
        }
    });
}

async function searchLocation() {
    const city = cityInput.value.trim();

    if (!city) {
        setStatus("Please enter a city or location.");
        return;
    }

    setStatus("Searching for " + city + "...");

    try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(city)}&limit=1`;

        const response = await fetch(url);
        const results = await response.json();

        if (results.length === 0) {
            setStatus("Location not found. Try another name.");
            return;
        }

        const place = results[0];
        const lat = Number(place.lat);
        const lng = Number(place.lon);
        explorationOrigin = {
          lat: lat,
          lng: lng
        };

        explorationMode = "city";

        map.flyTo([lat, lng], 14);

        if (marker) {
            marker.setLatLng([lat, lng]);
        } else {
            marker = L.marker([lat, lng]).addTo(map);
        }

        marker.bindPopup(place.display_name).openPopup();

        if (circle) {
            map.removeLayer(circle);
            circle = null;
        }

        setStatus("Showing results for " + place.display_name);
        
        findNearbyPlaces(lat, lng);

    } catch (error) {
        console.error(error);
        setStatus("Could not search location. Please try again.");
    }
}


// Store tourist place markers
function calculateDistance(lat1, lon1, lat2, lon2) {
    const earthRadius = 6371;

    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;

    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * Math.PI / 180) *
        Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) ** 2;

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return (earthRadius * c).toFixed(1);
}
let placeMarkers = [];

// Fetch a real photograph of a tourist attraction
async function getPlaceImage(placeName) {

    const url = new URL("https://commons.wikimedia.org/w/api.php");

    url.search = new URLSearchParams({
        action: "query",
        generator: "search",
        gsrsearch: placeName,
        gsrnamespace: "6",
        gsrlimit: "1",
        prop: "imageinfo",
        iiprop: "url",
        iiurlwidth: "600",
        format: "json",
        origin: "*"
    });

    try {
        const response = await fetch(url);
        const data = await response.json();

        const pages = data.query?.pages;

        if (!pages) return null;

        const image = Object.values(pages)[0];

        return image.imageinfo?.[0]?.thumburl || null;

    } catch (error) {
        console.error("Could not fetch attraction image:", error);
        return null;
    }
}


// Find nearby tourist attractions
async function findNearbyPlaces(lat, lng) {

    const placesContainer = document.getElementById("places-container");
    const seenPlaces = new Set();

    placesContainer.innerHTML = "<p>Finding nearby attractions...</p>";

    // Search within approximately 5 km
   
const query = `
    [out:json][timeout:40];
    (
      // Main tourist attractions
      node["tourism"~"attraction|museum|gallery|viewpoint"](around:20000,${lat},${lng});
      way["tourism"~"attraction|museum|gallery|viewpoint"](around:20000,${lat},${lng});
      relation["tourism"~"attraction|museum|gallery|viewpoint"](around:20000,${lat},${lng});

      // Historical places
      node["historic"~"castle|monument|fort|archaeological_site|memorial"](around:20000,${lat},${lng});
      way["historic"~"castle|monument|fort|archaeological_site|memorial"](around:20000,${lat},${lng});
      relation["historic"~"castle|monument|fort|archaeological_site|memorial"](around:20000,${lat},${lng});

      // Parks and gardens
      node["leisure"~"park|garden"](around:20000,${lat},${lng});
      way["leisure"~"park|garden"](around:20000,${lat},${lng});
      relation["leisure"~"park|garden"](around:20000,${lat},${lng});

      // Markets
      node["amenity"="marketplace"](around:20000,${lat},${lng});
      way["amenity"="marketplace"](around:20000,${lat},${lng});
      relation["amenity"="marketplace"](around:20000,${lat},${lng});

      // Natural attractions
      node["natural"~"water|beach"](around:20000,${lat},${lng});
      way["natural"~"water|beach"](around:20000,${lat},${lng});
      relation["natural"~"water|beach"](around:20000,${lat},${lng});
    );
    out center tags;
`;

    try {
        const response = await fetch(
            "https://ovp.dresel.systems/api-as/interpreter",
            {
                method: "POST",
                body: query
            }
        );

        const data = await response.json();

        // Remove old attraction markers
        placeMarkers.forEach(marker => map.removeLayer(marker));
        placeMarkers = [];

        placesContainer.innerHTML = "";

        if (!data.elements || data.elements.length === 0) {
            placesContainer.innerHTML = "<p>No tourist attractions found nearby.</p>";
            return;
        }

        
const sortedPlaces = [...data.elements].sort((a, b) => {
    function getPriority(place) {
        const tags = place.tags || {};

        if (tags.tourism === "attraction") return 1;
        if (tags.historic) return 2;
        if (tags.tourism === "museum") return 3;
        if (tags.tourism === "gallery") return 4;
        if (tags.tourism === "viewpoint") return 5;
        if (tags.leisure === "park") return 6;
        if (tags.leisure === "garden") return 7;
        if (tags.natural) return 8;
        if (tags.amenity === "marketplace") return 9;

        return 10;
    }

    return getPriority(a) - getPriority(b);
});

sortedPlaces.forEach(place => {
    if (placesContainer.children.length >= 20) return;


            const tags = place.tags || {};

            const name = tags.name || tags["name:en"];
            if (!name) {
              return;
            }
            const type = tags.tourism || tags.historic || "";

            const usefulTypes = [
              "attraction",
              "museum",
              "gallery",
              "castle",
              "monument",
              "fort",
              "archaeological_site",
              "viewpoint"
            ];

            if (!usefulTypes.includes(type)) {
              return;
            }
            const normalizedName = name.trim().toLowerCase();

            if (seenPlaces.has(normalizedName)) {
             return;
            }

            seenPlaces.add(normalizedName);
            // Skip generic places that are not major attractions
            if (tags.tourism === "attraction" && /ghat/i.test(name)) {
            return;
            }

            if (!name) return;

            const placeLat = place.lat ?? place.center?.lat;
            const placeLng = place.lon ?? place.center?.lon;
            const distance = calculateDistance(
              explorationOrigin.lat,
              explorationOrigin.lng,
              placeLat,
              placeLng
            );

            if (placeLat == null || placeLng == null) return;

            // Add marker to map
            const placeMarker = L.marker([placeLat, placeLng])
                .addTo(map)
                .bindPopup(name);

            placeMarkers.push(placeMarker);

            
// Create place card
  const card = document.createElement("div");
  card.className = "place-card";

// Create attraction image
  const image = document.createElement("img");
  image.className = "place-image";
  image.alt = name;

// Fetch the real photograph
  getPlaceImage(name).then(imageUrl => {
    if (imageUrl) {
        image.src = imageUrl;
    } else {
        image.src = "https://images.unsplash.com/photo-1500534623283-312aade485b7?auto=format&fit=crop&w=600&q=80";
    }
});

  card.appendChild(image);

// Add attraction name
  const heading = document.createElement("h3");
  heading.textContent = name;
  card.appendChild(heading);

// Add attraction category
  const category = document.createElement("p");
  category.textContent = tags.tourism || tags.historic || "Tourist attraction";
  card.appendChild(category);
  const distanceText = document.createElement("p");
  distanceText.textContent = "📍 " + distance + " km away";
  card.appendChild(distanceText);

// Add View on Map button
  const viewButton = document.createElement("button");
  viewButton.type = "button";
  viewButton.textContent = "View on map";

  viewButton.addEventListener("click", () => {
    document.getElementById("map").scrollIntoView({
        behavior: "smooth",
        block: "center"
    });

    map.flyTo([placeLat, placeLng], 17);
    placeMarker.openPopup();
});

  card.appendChild(viewButton);
  placesContainer.appendChild(card);
  });
  if (!placesContainer.children.length) {
            placesContainer.innerHTML = "<p>No named attractions found nearby.</p>";
        }

    } catch (error) {
        console.error(error);
        placesContainer.innerHTML =
            "<p>Could not load attractions. Please try again.</p>";
    }
}



            

        