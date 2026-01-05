sap.ui.define([
    "sap/ui/core/mvc/Controller"
], (Controller) => {
    "use strict";

    return Controller.extend("store.controller.Home", {
        onInit() {
            this.getOwnerComponent().getRouter().navTo("Dashboard");
        },
        onSelect (oEvent) {
            var sKey = oEvent.getParameter("key");
            var oRouter = this.getOwnerComponent().getRouter();
            if ( sKey === "inventory")
            {
                console.log("inventory clicked");
                oRouter.navTo("Inventory");
                console.log("navigated");
                
            }
            if( sKey === 'po')
            {
                console.log("Po clicked");
                oRouter.navTo("Po");
                console.log("navigated to Po");

            }
            if( sKey === 'so')
            {
                console.log("So clicked");
                oRouter.navTo("So");
                console.log("navigated to So");

            }
            if( sKey === 'dash')
            {
                console.log("dash clicked");
                oRouter.navTo("Dashboard");
                console.log("navigated to dash");

            }
             
        }
    });
});