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
    }, (error) => {
        console.warn("Staff Listener Error (Likely Unauthenticated):", error);
        if (callback) callback([]);
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

let availableRoles = [];
onSnapshot(collection(db, "roles"), (snapshot) => {
    availableRoles = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}, (error) => {
    console.warn("Roles Listener Permission Error (Likely Client):", error.message);
    availableRoles = [];
});

export const hasPermission = (email, permission) => {
    const staff = authorizedStaff.find(s => s.email === email || s.id === email);
    if (!staff || !staff.role) return false;

    // Owner always has all permissions
    if (staff.role.split(',').map(r => r.trim()).includes('owner')) return true;

    const userRoles = staff.role.split(',').map(r => r.trim());
    const userPermissions = new Set();

    userRoles.forEach(r => {
        const roleData = availableRoles.find(role => role.id === r);
        if (roleData && roleData.permissions) {
            roleData.permissions.forEach(p => userPermissions.add(p));
        }
    });

    return userPermissions.has(permission);
};

export const getRolesData = () => availableRoles;
