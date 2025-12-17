sap.ui.define([], function () {
    "use strict";

    let _initialized = false;
    let _db = null;

    function initFirebase() {
        if (_initialized) {
            return _db; // already initialized
        }

        const firebaseConfig = {
            apiKey: "AIzaSyBp_1gpUYrK6vlq2S1OTmOgUlcWe-rS63c",
            authDomain: "storemangement-cf3b2.firebaseapp.com",
            projectId: "storemangement-cf3b2",
            storageBucket: "storemangement-cf3b2.firebasestorage.app",
            messagingSenderId: "1073341472746",
            appId: "1:1073341472746:web:5bd07cd07066a404415c93",
            measurementId: "G-LQNXTMNRDT"
        };

        firebase.initializeApp(firebaseConfig);
        _db = firebase.firestore();
        _initialized = true;
    console.log("initialised firebase");
        return _db;
    }

    return {
        init: initFirebase,
    };
});