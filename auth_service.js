import { auth, provider, signInWithPopup, signInWithRedirect, signOut, onAuthStateChanged } from './firebase-config.js';
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
        if (error.code !== 'permission-denied') {
            console.warn("Staff Listener Error:", error);
        }
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
let rolesUnsubscribe = null;

export const listenToRoles = (callback) => {
    if (rolesUnsubscribe) rolesUnsubscribe();
    rolesUnsubscribe = onSnapshot(collection(db, "roles"), (snapshot) => {
        availableRoles = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if (callback) callback(availableRoles);
    }, (error) => {
        if (error.code !== 'permission-denied') {
            console.warn("Roles Listener Error:", error.message);
        }
        availableRoles = [];
        if (callback) callback([]);
    });
    return rolesUnsubscribe;
};

// Start roles listener when auth state changes if possible

// Start roles listener and merge staff profile when auth state changes
onAuthStateChanged(auth, async (user) => {
    if (user) {
        listenToRoles();
        await syncWorkerProfile(user);
    } else {
        if (rolesUnsubscribe) rolesUnsubscribe();
        rolesUnsubscribe = null;
        availableRoles = [];
    }
});

export const syncWorkerProfile = async (user) => {
    // 1. Check for legacy/invite doc (ID == Email)
    const emailDocRef = doc(db, "staff", user.email);
    // 2. Check for UID doc
    const uidDocRef = doc(db, "staff", user.uid);

    try {
        const [emailDocSnap, uidDocSnap] = await Promise.all([
            import('./firebase-config.js').then(m => m.getDoc(emailDocRef)),
            import('./firebase-config.js').then(m => m.getDoc(uidDocRef))
        ]);

        // If email doc exists (meaning user was invited by email)
        if (emailDocSnap.exists()) {
            const inviteData = emailDocSnap.data();

            // Merge invite data into UID doc
            await setDoc(uidDocRef, {
                ...inviteData,
                email: user.email,
                uid: user.uid,
                name: user.displayName || inviteData.name,
                // Keep existing stats if UID doc already existed, otherwise start fresh
                totalEarnings: uidDocSnap.exists() ? (uidDocSnap.data().totalEarnings || 0) : 0,
                lastActive: serverTimestamp()
            }, { merge: true });

            // Delete the duplicate email doc
            await deleteDoc(emailDocRef);
            console.log("Team GS: Staff profile migrated to UID.");
        }
    } catch (e) {
        console.error("Profile Sync Error:", e);
    }
};

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
