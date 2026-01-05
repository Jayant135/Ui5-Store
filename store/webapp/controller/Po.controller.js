sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "store/util/firebase",
    "sap/m/MessageToast",
    "sap/m/MessageBox"
], function (Controller, JSONModel, Firebase, MessageToast,MessageBox) {
    "use strict";

    return Controller.extend("store.controller.PO", {

        onInit: function () {
            this._db = Firebase.init();

            const oModel = new JSONModel({
                poList: [],
                categories: ["Groceries", "Stationary"],
                items: [],
                selectedCategory: "Groceries",
                activeItem: null,
                selectedPO: null,
                isEditMode: false,
                currentPO: {
                    poNumber: "",
                    vendorName: "",
                    vendorContact: "",
                    poDate: "",
                    items: [],
                    totalAmount: 0,
                }
            });

            this.getView().setModel(oModel, "po");
            this._loadPOs();
        },

        /* ================= LOAD PREVIOUS POs ================= */
        _loadPOs: function () {
            const aPOs = [];
            this._db.collection("purchaseOrders").orderBy("poNumber", "desc").get().then(snapshot => {
                snapshot.forEach(doc => {
                    const d = doc.data();
                    aPOs.push({
                        id: doc.id,
                        ...d,
                        itemsCount: d.items.length
                    });
                });
                this.getView().getModel("po").setProperty("/poList", aPOs);
            });
        },

        /* ================= CREATE PO ================= */
        onCreatePO: async function () {
            const oModel = this.getView().getModel("po");

            oModel.setProperty("/isEditMode", false);

            // Fetch last PO number
            const counterRef = this._db.collection("counters").doc("poNumber");
            const counterSnap = await counterRef.get();

            let lastNumber = 1000; // default starting number
            if (counterSnap.exists) {
                lastNumber = counterSnap.data().lastNumber;
            }

            const newPONumber = lastNumber + 1;

            // // Update counter in Firestore
            // await counterRef.set({ lastNumber: newPONumber });

            // Set current PO
            oModel.setProperty("/currentPO", {
                poNumber: "PO-" + newPONumber,
                vendorName: "",
                vendorContact: "",
                poDate: new Date().toLocaleDateString(),
                items: [],
                totalAmount: 0
            });

            this._db.collection("inventory")
                .where("category", "==", "Groceries")
                .get()
                .then(snapshot => {
                    const aItems = [];
                    snapshot.forEach(doc => {
                        aItems.push({ id: doc.id, ...doc.data() });
                    });
                    oModel.setProperty("/items", aItems);
                });


            this.byId("poDialog").open();
        },

        /* ================= CATEGORY CHANGE ================= */
        onCategoryChange: function (oEvent) {
            const sCat = oEvent.getSource().getSelectedItem().getText();
            const oModel = this.getView().getModel("po");

            oModel.setProperty("/selectedCategory", sCat);
            oModel.setProperty("/items", []);
            oModel.setProperty("/activeItem", null);

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

        /* ================= ITEM CHANGE ================= */
        onItemChange: function (oEvent) {
            const sValue = oEvent.getSource().getValue();
            const oModel = this.getView().getModel("po");
            const aItems = oModel.getProperty("/items");
            const sCat = oModel.getProperty("/selectedCategory");

            const oExisting = aItems.find(i => i.name === sValue);

            if (oExisting) {
                oModel.setProperty("/activeItem", {
                    ...oExisting,
                    isNew: false
                });
            } else {
                oModel.setProperty("/activeItem", {
                    name: sValue,
                    category: sCat,
                    cost: "",
                    price: "",
                    isNew: true
                });
            }
        },

        /* ================= ADD ITEM ================= */
        onAddItem: function () {
            const oModel = this.getView().getModel("po");
            const oItem = oModel.getProperty("/activeItem");
            const iQty = Number(this.byId("qtyInput").getValue());

            if (!oItem || !iQty) {
                MessageToast.show("Enter item and quantity");
                return;
            }
            if (iQty <= 0) {
                MessageToast.show("Quantity must be greater than 0");
                return;
            }
            if (oItem.isNew && (!oItem.cost || !oItem.price)) {
                MessageToast.show("Enter cost and selling price");
                return;
            }

            const oPOItem = {
                itemId: oItem.id || null,
                name: oItem.name,
                category: oItem.category,
                cost: Number(oItem.cost),
                price: Number(oItem.price || 0),
                qty: iQty,
                total: Number(oItem.cost) * iQty,
                isNew: oItem.isNew
            };

            const aItems = oModel.getProperty("/currentPO/items");
            aItems.push(oPOItem);

            oModel.setProperty(
                "/currentPO/totalAmount",
                aItems.reduce((s, i) => s + i.total, 0)
            );

            oModel.setProperty("/activeItem", null);
            this.byId("itemSelect").setValue("");
            this.byId("qtyInput").setValue("");

            oModel.refresh(true);
        },

        onPOSelectionChange: function (oEvent) {
            const oItem = oEvent.getParameter("listItem");

            if (!oItem) {
                this.getView().getModel("po").setProperty("/selectedPO", null);
                return;
            }

            const oSelectedPO =
                oItem.getBindingContext("po").getObject();

            this.getView()
                .getModel("po")
                .setProperty("/selectedPO", oSelectedPO);
        },

        onRemoveItem: function () {
            const oModel = this.getView().getModel("po");
            const oTable = this.byId("poItemsTable");
            const oItem = oTable.getSelectedItem();

            if (!oItem) {
                MessageToast.show("Select an item to remove");
                return;
            }

            const oCtx = oItem.getBindingContext("po");
            const iIndex = parseInt(oCtx.getPath().split("/").pop(), 10);

            const aItems = oModel.getProperty("/currentPO/items");
            aItems.splice(iIndex, 1);

            // 🔄 Recalculate total
            oModel.setProperty(
                "/currentPO/totalAmount",
                aItems.reduce((sum, i) => sum + i.total, 0)
            );

            oModel.refresh(true);
        },



        onEditPO: function () {
            const oModel = this.getView().getModel("po");
            const oSelectedPO = oModel.getProperty("/selectedPO");

            if (!oSelectedPO) {
                MessageToast.show("Select one PO to edit");
                return;
            }

            // 🔐Deep copy to avoid modifying list directly
            const oPOCopy = JSON.parse(JSON.stringify(oSelectedPO));

            oModel.setProperty("/currentPO", oPOCopy);
            oModel.setProperty("/isEditMode", true);

            this.byId("poDialog").open();
        },

        onDeletePO: function () {
            const oModel = this.getView().getModel("po");
            const oSelectedPO = oModel.getProperty("/selectedPO");

            if (!oSelectedPO) {
                MessageToast.show("Select one PO to delete");
                return;
            }

            MessageBox.confirm(
                "Are you sure you want to delete PO " + oSelectedPO.poNumber + "?",
                {
                    actions: [MessageBox.Action.YES, MessageBox.Action.NO],
                    onClose: (sAction) => {
                        if (sAction === MessageBox.Action.YES) {
                            this._db
                                .collection("purchaseOrders")
                                .doc(oSelectedPO.id)
                                .delete()
                                .then(() => {
                                    MessageToast.show("PO deleted");
                                    oModel.setProperty("/selectedPO", null);
                                    this._loadPOs();
                                });
                        }
                    }
                }
            );
        },



        /* ================= SAVE PO ================= */
        onSavePO: function () {
            const oModel = this.getView().getModel("po");
            const oPO = oModel.getProperty("/currentPO");
            const bEdit = oModel.getProperty("/isEditMode");

            if (!oPO.items.length) {
                MessageToast.show("Add at least one item");
                return;
            }

            if (!oPO.vendorName || !oPO.vendorContact) {
                MessageToast.show("Enter vendor name and contact");
                return;
            }

            const oBatch = this._db.batch();
            const oCategoryTotals = {};

            // CREATE MODE
            if (!bEdit) {

                oPO.items.forEach(i => {
                    oCategoryTotals[i.category] =
                        (oCategoryTotals[i.category] || 0) + i.total;

                    if (i.isNew) {
                        const oInvRef = this._db.collection("inventory").doc();
                        oBatch.set(oInvRef, {
                            name: i.name,
                            category: i.category,
                            stock: i.qty,
                            cost: i.cost,
                            price: i.price
                        });
                    } else {
                        const oInvRef = this._db.collection("inventory").doc(i.itemId);
                        oBatch.update(oInvRef, {
                            stock: Firebase.FieldValue.increment(i.qty)
                        });
                    }
                });

                const oPORef = this._db.collection("purchaseOrders").doc();
                oBatch.set(oPORef, {
                    ...oPO,
                    categoryTotals: oCategoryTotals
                });

            }

            // EDIT MODE
            else {

                const oPORef = this._db.collection("purchaseOrders").doc(oPO.id);

                oPO.items.forEach(i => {
                    oCategoryTotals[i.category] =
                        (oCategoryTotals[i.category] || 0) + i.total;
                });

                oBatch.update(oPORef, {
                    vendorName: oPO.vendorName,
                    vendorContact: oPO.vendorContact,
                    items: oPO.items,
                    totalAmount: oPO.totalAmount,
                    categoryTotals: oCategoryTotals,
                    updatedOn: new Date().toISOString()
                });
            }

            // COMMIT
            oBatch.commit().then(() => {
                MessageToast.show(
                    bEdit ? "PO updated successfully" : "PO created successfully"
                );

                // Counter ONLY for create
                if (!bEdit) {
                    this._db.collection("counters")
                        .doc("poNumber")
                        .set({
                            lastNumber: parseInt(oPO.poNumber.slice(3))
                        });
                }

                this.byId("poDialog").close();
                oModel.setProperty("/isEditMode", false);
                this._loadPOs();
            });
        },


        /* ================= PO DETAILS ================= */
        onShowPODetails: function (oEvent) {
            const oPO = oEvent.getSource()
                .getBindingContext("po")
                .getObject();

            this.getView()
                .getModel("po")
                .setProperty("/selectedPO", oPO);

            this.byId("poDetailDialog").open();
        },

        onClosePODetail: function () {
            this.byId("poDetailDialog").close();
        },

        onCancelPO: function () {
            this.byId("poDialog").close();
        }
    });
});
