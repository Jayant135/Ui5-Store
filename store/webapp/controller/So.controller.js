sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "store/util/firebase",
    "sap/m/MessageToast",
    "sap/m/MessageBox"
], function (Controller, JSONModel, Firebase, MessageToast, MessageBox) {
    "use strict";

    return Controller.extend("store.controller.So", {

        onInit: function () {
            this._db = Firebase.init();

            const oSOModel = new JSONModel({
                soList: [],
                categories: ["Groceries", "Stationary"],
                items: [],
                selectedItem: null,
                currentSO: {
                    soNumber: "",
                    soDate: "",
                    customer: "",
                    items: [],
                    totalAmount: 0
                }
            });

            this.getView().setModel(oSOModel, "so");

            const oDetailModel = new JSONModel({ selectedSO: null });
            this.getView().setModel(oDetailModel, "soDetail");

            this._loadSOs();
        },

        /* ================= LOAD SOs ================= */

        _loadSOs: function () {
            const oModel = this.getView().getModel("so");
            const aSOs = [];

            this._db.collection("salesOrders").get().then(snapshot => {
                snapshot.forEach(doc => {
                    aSOs.push(doc.data());
                });
                oModel.setProperty("/soList", aSOs);
            });
        },

        /* ================= SO NUMBER ================= */

        _generateSONumber: async function () {
            const ref = this._db.collection("counters").doc("soNumber");
            const snap = await ref.get();
            let last = snap.exists ? snap.data().lastNumber : 1000;
            last++;
            await ref.set({ lastNumber: last });
            return "SO-" + last;
        },

        /* ================= CREATE SO ================= */

        onCreateSO: async function () {
            const soNumber = await this._generateSONumber();
            const oModel = this.getView().getModel("so");

            oModel.setProperty("/currentSO", {
                soNumber,
                soDate: new Date().toLocaleDateString(),
                customer: "",
                items: [],
                totalAmount: 0
            });

            oModel.setProperty("/items", []);
            oModel.setProperty("/selectedItem", null);

            this.byId("soDialog").open();
        },

        onCancelSO: function () {
            this.byId("soDialog").close();
        },

        /* ================= CATEGORY ================= */

        onCategoryChange: function (oEvent) {
            const sCat = oEvent.getSource().getSelectedItem().getText();
            const oModel = this.getView().getModel("so");

            this._db.collection("inventory")
                .where("category", "==", sCat)
                .get()
                .then(snapshot => {
                    const aItems = [];
                    snapshot.forEach(doc => {
                        aItems.push({ id: doc.id, ...doc.data() });
                    });
                    oModel.setProperty("/items", aItems);
                });
        },

        /* ================= ITEM ================= */

        onItemSelect: function (oEvent) {
            const sId = oEvent.getSource().getSelectedKey();
            const oModel = this.getView().getModel("so");
            const oItem = oModel.getProperty("/items").find(i => i.id === sId);
            oModel.setProperty("/selectedItem", oItem);
        },

        onAddItem: function () {
            const oModel = this.getView().getModel("so");
            const oItem = oModel.getProperty("/selectedItem");
            const qty = Number(this.byId("soQtyInput").getValue());

            if (!oItem || !qty) {
                MessageToast.show("Select item and quantity");
                return;
            }

            const oSOItem = {
                itemId: oItem.id,
                name: oItem.name,
                category: oItem.category,
                price: oItem.price,
                qty,
                total: oItem.price * qty
            };

            const aItems = oModel.getProperty("/currentSO/items");
            aItems.push(oSOItem);

            oModel.setProperty(
                "/currentSO/totalAmount",
                aItems.reduce((s, i) => s + i.total, 0)
            );

            this.byId("soQtyInput").setValue("");
            oModel.refresh(true);
        },

        /* ================= SAVE SO ================= */

        onSaveSO: async function () {
            const oModel = this.getView().getModel("so");
            const oSO = oModel.getProperty("/currentSO");

            if (!oSO.items.length || !oSO.customer) {
                MessageToast.show("Enter customer and add items");
                return;
            }

            const batch = this._db.batch();
            const oCategoryTotals = {};
            oSO.items.forEach(i => {
                const invRef = this._db.collection("inventory").doc(i.itemId);
                batch.update(invRef, {
                    stock: Firebase.FieldValue.increment(-i.qty)
                });
                oCategoryTotals[item.category]=
                (oCategoryTotals[items.category] || 0 ) + items.total;
            });

            const soRef = this._db.collection("salesOrders").doc();
            batch.set(soRef, {
                ...oSO,
                oCategoryTotals: oCategoryTotals
            });

            try {
                await batch.commit();
                MessageToast.show("SO Created");
                this.byId("soDialog").close();
                this._loadSOs();
            } catch (e) {
                MessageBox.error("Failed to save SO");
            }
        },

        /* ================= DETAILS ================= */

        onSORowPress: function (oEvent) {
            const oSO = oEvent.getSource().getBindingContext("so").getObject();
            const oModel = this.getView().getModel("soDetail");
            oModel.setProperty("/selectedSO", oSO);

             if (!this._soDetailDialog) {
        this._soDetailDialog = this._createSODetailDialog();
    }

    this._soDetailDialog.open();
        },

        _createSODetailDialog: function () {
    const oDialog = new sap.m.Dialog({
        title: "Sales Order Details",
        contentWidth: "700px",
        draggable: true,
        content: [
            new sap.m.ObjectHeader({
                title: "{soDetail>/selectedSO/soNumber}",
                number: "{soDetail>/selectedSO/totalAmount}",
                numberUnit: "₹",
                attributes: [
                    new sap.m.ObjectAttribute({
                        text: "{soDetail>/selectedSO/soDate}"
                    }),
                    new sap.m.ObjectAttribute({
                        text: "Customer: {soDetail>/selectedSO/customer}"
                    })
                ]
            }),
            new sap.m.Table({
                items: "{soDetail>/selectedSO/items}",
                columns: [
                    new sap.m.Column({ header: new sap.m.Text({ text: "Item" }) }),
                    new sap.m.Column({ header: new sap.m.Text({ text: "Qty" }) }),
                    new sap.m.Column({ header: new sap.m.Text({ text: "Price" }) }),
                    new sap.m.Column({ header: new sap.m.Text({ text: "Total" }) })
                ],
                items: {
                    path: "soDetail>/selectedSO/items",
                    template: new sap.m.ColumnListItem({
                        cells: [
                            new sap.m.Text({ text: "{soDetail>name}" }),
                            new sap.m.Text({ text: "{soDetail>qty}" }),
                            new sap.m.Text({ text: "{soDetail>price}" }),
                            new sap.m.ObjectNumber({
                                number: "{soDetail>total}",
                                unit: "₹"
                            })
                        ]
                    })
                }
            })
        ],
        beginButton: new sap.m.Button({
            text: "Close",
            press: function () {
                oDialog.close();
            }
        })
    });

    this.getView().addDependent(oDialog);
    return oDialog; // ✅ RETURN dialog
}


    });
});
