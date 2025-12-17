sap.ui.define([
    "sap/ui/core/mvc/Controller"
], (Controller) => {
    "use strict";

    return Controller.extend("store.controller.Home", {
        onInit() {
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

             
        }
    });
});