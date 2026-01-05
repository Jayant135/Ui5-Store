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
 
            const oModel = new JSONModel({
                soList: [],
                categories: ["Groceries", "Stationary"],
                items: [],
                selectedItem: null,
                selectedSO: null,
                mode: "CREATE", // CREATE | EDIT
                currentSO: {
                    soNumber: "",
                    soDate: "",
                    customer: "",
                    items: [],
                    totalAmount: 0
                }
            });
 
            this.getView().setModel(oModel, "so");
            const oDetailModel = new JSONModel({ selectedSO: null });
            this.getView().setModel(oDetailModel, "soDetail");
 
            this._loadSOs();
        },
 
        /* ================= LOAD ================= */
 
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
 
        /* ================= SELECTION ================= */
 
        onSOSelect: function (oEvent) {
            const oSO = oEvent.getParameter("listItem")
                .getBindingContext("so")
                .getObject();
 
            this.getView().getModel("so").setProperty("/selectedSO", oSO);
        },
 
        /* ================= CREATE ================= */
 
        _generateSONumber: async function () {
            const ref = this._db.collection("counters").doc("soNumber");
            const snap = await ref.get();
            let last = snap.exists ? snap.data().lastNumber : 1000;
            last++;
            await ref.set({ lastNumber: last });
            return "SO-" + last;
        },
 
        onCreateSO: async function () {
            const soNumber = await this._generateSONumber();
            const oModel = this.getView().getModel("so");
 
            oModel.setProperty("/mode", "CREATE");
            oModel.setProperty("/currentSO", {
                soNumber,
                soDate: new Date().toLocaleDateString(),
                customer: "",
                items: [],
                totalAmount: 0
            });
 
            this._loadItemsByCategory("Groceries");
            this.byId("soDialog").open();
        },
 
        /* ================= EDIT ================= */
 
        onEditSO: function () {
            const oModel = this.getView().getModel("so");
            const oSO = oModel.getProperty("/selectedSO");
 
            if (!oSO) {
                MessageToast.show("Select a Sales Order");
                return;
            }
 
            oModel.setProperty("/mode", "EDIT");
            oModel.setProperty("/currentSO", JSON.parse(JSON.stringify(oSO)));
 
            this._loadItemsByCategory("Groceries");
            this.byId("soDialog").open();
        },
 
        /* ================= DELETE ================= */
 
        onDeleteSO: function () {
            const oModel = this.getView().getModel("so");
            const oSO = oModel.getProperty("/selectedSO");
 
            if (!oSO) {
                MessageToast.show("Select a Sales Order");
                return;
            }
 
            MessageBox.confirm(
                `Delete Sales Order ${oSO.soNumber}?`,
                {
                    onClose: async (sAction) => {
                        if (sAction === MessageBox.Action.OK) {
                            const snap = await this._db
                                .collection("salesOrders")
                                .where("soNumber", "==", oSO.soNumber)
                                .get();
 
                            snap.forEach(doc => doc.ref.delete());
                            MessageToast.show("SO Deleted");
 
                            oModel.setProperty("/selectedSO", null);
                            this._loadSOs();
                        }
                    }
                }
            );
        },
 
        /* ================= ITEMS ================= */
 
        _loadItemsByCategory: function (sCategory) {
            const oModel = this.getView().getModel("so");
 
            this._db.collection("inventory")
                .where("category", "==", sCategory)
                .get()
                .then(snapshot => {
                    const aItems = [];
                    snapshot.forEach(doc => {
                        aItems.push({ id: doc.id, ...doc.data() });
                    });
                    oModel.setProperty("/items", aItems);
                });
        },
 
        onCategoryChange: function (oEvent) {
            this._loadItemsByCategory(
                oEvent.getSource().getSelectedItem().getText()
            );
        },
 
        onItemSelect: function (oEvent) {
            const sId = oEvent.getSource().getSelectedKey();
            const oModel = this.getView().getModel("so");
            const oItem = oModel.getProperty("/items")
                .find(i => i.id === sId);
 
            oModel.setProperty("/selectedItem", oItem);
        },
 
        onAddItem: function () {
            const oModel = this.getView().getModel("so");
            const oItem = oModel.getProperty("/selectedItem");
            const qty = Number(this.byId("soQtyInput").getValue());
 
            if (!oItem || qty <= 0) {
                MessageToast.show("Select item & quantity");
                return;
            }
 
            if (qty > oItem.stock) {
                MessageToast.show("Insufficient stock");
                return;
            }
 
            const aItems = oModel.getProperty("/currentSO/items");
 
            const oSOItem = {
                itemId: oItem.id,
                name: oItem.name,
                category: oItem.category,
                price: oItem.price,
                qty,
                total: qty * oItem.price
            };
 
            const aNewItems = aItems.concat(oSOItem);
            oModel.setProperty("/currentSO/items", aNewItems);
 
            oModel.setProperty(
                "/currentSO/totalAmount",
                aNewItems.reduce((s, i) => s + i.total, 0)
            );
 
            this.byId("soQtyInput").setValue("");
            this.byId("soItemSelect").setSelectedKey("");
        },
 
        /* ================= SAVE ================= */
 
        onSaveSO: async function () {
            const oModel = this.getView().getModel("so");
            const oSO = oModel.getProperty("/currentSO");
            const sMode = oModel.getProperty("/mode");
 
            if (!oSO.customer || !oSO.items.length) {
                MessageToast.show("Enter customer & items");
                return;
            }
 
            try {
                if (sMode === "CREATE") {
                    await this._db.collection("salesOrders").add(oSO);
                    MessageToast.show("SO Created");
                } else {
                    const snap = await this._db
                        .collection("salesOrders")
                        .where("soNumber", "==", oSO.soNumber)
                        .get();
 
                    snap.forEach(doc => doc.ref.update(oSO));
                    MessageToast.show("SO Updated");
                }
 
                this.byId("soDialog").close();
                oModel.setProperty("/selectedSO", null);
                oModel.setProperty("/mode", "CREATE");
                this._loadSOs();
 
            } catch (e) {
                MessageBox.error("Save failed");
            }
        },
 
        onCancelSO: function () {
            this.byId("soDialog").close();
        },
        onRemoveItem: function (oEvent) {
            const oCtx = oEvent.getSource().getBindingContext("so");
            const oItem = oCtx.getObject();
            const oModel = this.getView().getModel("so");
 
            const aItems = oModel.getProperty("/currentSO/items")
                .filter(i => i !== oItem);
 
            oModel.setProperty("/currentSO/items", aItems);
 
            const total = aItems.reduce((sum, i) => sum + i.total, 0);
            oModel.setProperty("/currentSO/totalAmount", total);
        },
        onQtyChange: function (oEvent) {
            const oInput = oEvent.getSource();
            const oCtx = oInput.getBindingContext("so");
            const oItem = oCtx.getObject();
            const oModel = this.getView().getModel("so");
 
            const qty = Number(oInput.getValue());
            if (qty <= 0) {
                MessageToast.show("Quantity must be greater than 0");
                return;
            }
            if (qty > oItem.stock) {
                MessageToast.show("Exceeds available stock");
                return;
            }
 
            oItem.qty = qty;
            oItem.total = qty * oItem.price;
 
            // Recalculate SO total
            const aItems = oModel.getProperty("/currentSO/items");
            const total = aItems.reduce((sum, i) => sum + i.total, 0);
 
            oModel.setProperty("/currentSO/totalAmount", total);
            oModel.refresh(true);
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
            return oDialog;
        },
        onShowSODetails: function (oEvent) {
            const oSO = oEvent
                .getSource()
                .getBindingContext("so")
                .getObject();
 
            if (!this._soDetailDialog) {
                this._soDetailDialog = this._createSODetailDialog();
            }
 
            this.getView()
                .getModel("soDetail")
                .setProperty("/selectedSO", oSO);
 
            this._soDetailDialog.open();
        }
 
    });
});