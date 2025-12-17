sap.ui.define([
    "sap/ui/core/UIComponent",
    "store/model/models",
    "store/util/firebase"
], (UIComponent, models, Firebase) => {
    "use strict";

    return UIComponent.extend("store.Component", {
        metadata: {
            manifest: "json",
            interfaces: [
                "sap.ui.core.IAsyncContentCreation"
            ]
        },

        init() {
            // call the base component's init function
            UIComponent.prototype.init.apply(this, arguments);
            
            // Initialise Firebase
            Firebase.init();

            // set the device model
            this.setModel(models.createDeviceModel(), "device");

            // enable routing
            this.getRouter().initialize();
        }
    });
});