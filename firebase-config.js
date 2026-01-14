import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, query, where, onSnapshot, orderBy, serverTimestamp, doc, updateDoc, getDoc, limit, increment, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyCryxMK0w8zo0fnCXDe2afxMWGXy_-Aw3Y",
    authDomain: "bounty-rush-54fa0.firebaseapp.com",
    projectId: "bounty-rush-54fa0",
    storageBucket: "bounty-rush-54fa0.firebasestorage.app",
    messagingSenderId: "1068173867620",
    appId: "1:1068173867620:web:d6e89b6a7869d451833d71",
    measurementId: "G-K5N3XZZR71"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const provider = new GoogleAuthProvider();

export { signInWithPopup, signOut, onAuthStateChanged, collection, addDoc, query, where, onSnapshot, orderBy, serverTimestamp, doc, updateDoc, getDoc, limit, increment, setDoc };
