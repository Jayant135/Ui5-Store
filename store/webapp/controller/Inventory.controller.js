sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "store/util/firebase",
    "sap/m/MessageBox",
    "sap/m/MessageToast"
], function (Controller, JSONModel, Firebase, MessageBox, MessageToast) {
    "use strict";

    return Controller.extend("store.controller.Inventory", {

        onInit: function () {
            this._db = Firebase.init();
            //   this._sSelectedCategory = "Groceries"; // default
            console.log("DB object:", this._db);
            console.log("collection fn:", this._db.collection);
            const oModel = new JSONModel({
                selectedCategory: "",
                items: [],
                showTable: false
            });
            this.getView().setModel(oModel, "inv");

            //   this._loadItems();
        },

        // 🔹 Load items by category
        _loadItems: function () {
            const aItems = [];
            this._db.collection("inventory")
                .where("category", "==", this._sSelectedCategory)
                .get()
                .then(snapshot => {
                    snapshot.forEach(doc => {
                        aItems.push({ id: doc.id, _edit: false, ...doc.data() });
                    });
                    this.getView()
                        .getModel("inv")
                        .setProperty("/items", aItems);
                });
        },

        // 🔹 Tile click handler
        onCategoryPress: function (oEvent) {
            this._sSelectedCategory =
                oEvent.getSource().getCustomData()[0].getValue();
            MessageToast.show(
                this._sSelectedCategory + " selected"
            );
            this.getView().getModel("inv").setProperty("/selectedCategory", this._sSelectedCategory);
            this.getView().getModel("inv").setProperty("/showTable", true);

            this._loadItems();
        },

        // 🔹 ADD
        onAdd: function () {
            this.byId("addDialog").open();
        },


        // 🔹 EDIT
        // onEdit: function () {
        //     const oItem =
        //         this.byId("inventoryTable").getSelectedItem();

        //     if (!oItem) {
        //         MessageToast.show("Select an item");
        //         return;
        //     }

        //     const oData =
        //         oItem.getBindingContext("inv").getObject();

        //     this._db.collection("inventory")
        //         .doc(oData.id)
        //         .update({ stock: oData.stock + 1 })
        //         .then(() => {
        //             MessageToast.show("Stock updated");
        //             this._loadItems();
        //         });
        // },
        onEdit: function () {
            const oTable = this.byId("inventoryTable");
            const aItems = oTable.getSelectedItems();
            const oButton = this.byId("btnEdit");
            const oModel = this.getView().getModel("inv");
            const that = this; // 👈 IMPORTANT

            if (!aItems.length) {
                MessageToast.show("Select at least one row");
                return;
            }

            // ================= ENTER EDIT MODE =================
            if (oButton.getText() === "Edit") {

                this._aEditBackup = [];

                aItems.forEach(oItem => {
                    const oData = oItem.getBindingContext("inv").getObject();
                    this._aEditBackup.push(Object.assign({}, oData));
                    oData._edit = true;
                });

                oButton.setText("Display");
                oModel.refresh(true);
                return; // 👈 yahin function khatam
            }

            // ================= EXIT EDIT MODE =================
            MessageBox.warning(
                "Changes made will be lost. Do you want to continue?",
                {
                    actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
                    onClose: function (sAction) {
                        if (sAction === MessageBox.Action.OK) {

                            that._aEditBackup.forEach(oBackup => {
                                const oCurrent = oModel.getProperty("/items")
                                    .find(i => i.id === oBackup.id);

                                Object.assign(oCurrent, oBackup);
                                oCurrent._edit = false;
                            });

                            oButton.setText("Edit");
                            oModel.refresh(true);
                        }
                    }
                }
            );
        },


        onSave: function () {
            const oTable = this.byId("inventoryTable");
            const aItems = oTable.getSelectedItems();

            if (!aItems.length) {
                MessageToast.show("Nothing to save");
                return;
            }

            const oBatch = this._db.batch();

            aItems.forEach(oItem => {
                const oData = oItem.getBindingContext("inv").getObject();
                const oRef = this._db.collection("inventory").doc(oData.id);

                oBatch.update(oRef, {
                    name: oData.name,
                    stock: Number(oData.stock),
                    cost: Number(oData.cost),
                    price: Number(oData.price)
                });

                oData._edit = false;
            });

            oBatch.commit().then(() => {
                MessageToast.show("Changes saved");
                this.byId("btnEdit").setText("Edit");
                this.getView().getModel("inv").refresh(true);
            });
        },


        // 🔹 DELETE
        onDelete: function () {
            const oItem =
                this.byId("inventoryTable").getSelectedItems();

            if (!oItem) {
                MessageToast.show("Select an item");
                return;
            }

            const oData =
                oItem.getBindingContext("inv").getObject();

            this._db.collection("inventory")
                .doc(oData.id)
                .delete()
                .then(() => {
                    MessageToast.show("Item deleted");
                    this._loadItems();
                });
        },
        onSaveItem: function () {
            const sName = this.byId("inpName").getValue();
            const iStock = Number(this.byId("inpStock").getValue());
            const fCost = Number(this.byId("inpCost").getValue());
            const fPrice = Number(this.byId("inpPrice").getValue());

            if (!sName) {
                sap.m.MessageToast.show("Item name is required");
                return;
            }

            const oItem = {
                name: sName,
                category: this._sSelectedCategory,
                stock: iStock || 0,
                cost: fCost || 0,
                price: fPrice || 0
            };
            console.log(oItem);
            this._db.collection("inventory").add(oItem).then(() => {
                sap.m.MessageToast.show("Item added");
                this._loadItems();
                this._resetDialog();
            });
            this.byId("btnEdit").setText("Edit");

        },
        onCancelDialog: function () {
            this._resetDialog();
        },

        _resetDialog: function () {
            this.byId("addDialog").close();
            this.byId("inpName").setValue("");
            this.byId("inpStock").setValue("");
            this.byId("inpCost").setValue("");
            this.byId("inpPrice").setValue("");
        },



    });
});
