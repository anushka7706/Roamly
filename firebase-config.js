import { initializeApp } from
  "https://www.gstatic.com/firebasejs/13.4.0/firebase-app.js";

import { getAuth } from
  "https://www.gstatic.com/firebasejs/13.4.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyB9fQsXKCp_WjETbF9zlHt7Ce9BZOsHaLY",

  authDomain: "roamly-44000.firebaseapp.com",

  projectId: "roamly-44000",

  storageBucket: "roamly-44000.firebasestorage.app",

  messagingSenderId: "468259021940",

  appId: "1:468259021940:web:375154cebe03cabdbf5d21",

  measurementId: "G-ZEBE6JZT7G"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
