import { auth, provider, signInWithPopup, signInWithRedirect, signOut } from './firebase-config.js';
import { db, doc, setDoc, deleteDoc, serverTimestamp, onSnapshot, collection } from './firebase-config.js';

export const login = async () => {
    try {
        await signInWithPopup(auth, provider);
    } catch (error) {
        console.warn("Popup blocked or COOP error, falling back to redirect...", error);
        try {
            await signInWithRedirect(auth, provider);
        } catch (redirError) {
            console.error("Critical Auth Error:", redirError);
        }
    }
};

export const logout = () => signOut(auth);

let authorizedStaff = [];

export const listenToWorkers = (callback) => {
    return onSnapshot(collection(db, "staff"), (snapshot) => {
        authorizedStaff = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if (callback) callback(authorizedStaff);
    });
};

export const isWorker = (email) => {
    const staff = authorizedStaff.find(s => s.email === email || s.id === email);
    return !!staff && !!staff.role;
};

export const getUserRole = (email) => {
    const staff = authorizedStaff.find(s => s.email === email || s.id === email);
    return staff ? staff.role : null;
};

export const setStaffRole = async (email, role) => {
    try {
        const staffRef = doc(db, "staff", email);
        await setDoc(staffRef, {
            email: email,
            role: role,
            updatedAt: serverTimestamp()
        }, { merge: true });
        return true;
    } catch (error) {
        console.error("Set Role Error:", error);
        return false;
    }
};

export const deleteStaff = async (docId) => {
    try {
        await deleteDoc(doc(db, "staff", docId));
        return true;
    } catch (error) {
        console.error("Delete Staff Error:", error);
        return false;
    }
};
