sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "store/util/firebase",
    "sap/m/MessageToast"
], function (Controller, JSONModel, Firebase, MessageToast) {
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
            const oItem = oTable.getSelectedItem();

            if (!oItem) {
                MessageToast.show("Select a row first");
                return;
            }

            const oCtx = oItem.getBindingContext("inv");
            const oData = oCtx.getObject();

            // backup original data
            // if (this._oEditBackup == true) {
            //     MessageBox.warning("Changes made will be lost.Do you want to continue.", {
            //         actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
            //         emphasizedAction: MessageBox.Action.OK,
            //         onClose: function (sAction) {
            //             MessageToast.show("Action selected: " + sActin);
            //         },
            //         dependentOn: this.getView()
            //     })
            // }
            // this._oEditBackup = Object.assign({}, oData);

            // enable edit mode only for this row
            oData._edit = true;

            oCtx.getModel().refresh(true);
        },

        onSave: function () {
            const oTable = this.byId("inventoryTable");
            const oItem = oTable.getSelectedItem();

            if (!oItem) {
                MessageToast.show("No row selected");
                return;
            }

            const oCtx = oItem.getBindingContext("inv");
            const oData = oCtx.getObject();

            const oPayload = {
                name: oData.name,
                stock: Number(oData.stock),
                cost: Number(oData.cost),
                price: Number(oData.price)
            };

            this._db.collection("inventory")
                .doc(oData.id)
                .update(oPayload)
                .then(() => {
                    MessageToast.show("Item updated");
                    oData._edit = false;
                    oCtx.getModel().refresh(true);
                });
        },

        onCancel: function () {
            const oTable = this.byId("inventoryTable");
            const oItem = oTable.getSelectedItem();

            // if (!oItem || !this._oEditBackup) {
            //     return;
            // }

            const oCtx = oItem.getBindingContext("inv");
            const oData = oCtx.getObject();

            // // restore original values
            // Object.assign(oData, this._oEditBackup);
            oData._edit = false;
            this._loadItems();
            // oCtx.getModel().refresh(true);
        },




        // 🔹 DELETE
        onDelete: function () {
            const oItem =
                this.byId("inventoryTable").getSelectedItem();

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
