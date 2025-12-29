sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "store/util/firebase",
    "sap/m/MessageToast"
], function (Controller, JSONModel, Firebase, MessageToast) {
    "use strict";

    return Controller.extend("store.controller.PO", {

        onInit: function () {
            this._db = Firebase.init();

            const oModel = new JSONModel({
                poList: [],
                categories: ["Groceries", "Stationary"],
                items: [],
                selectedCategory: "",
                activeItem: null,
                selectedPO: null,
                currentPO: {
                    poNumber: "",
                    poDate: "",
                    items: [],
                    totalAmount: 0
                }
            });

            this.getView().setModel(oModel, "po");
            this._loadPOs();
        },

        /* ================= LOAD PREVIOUS POs ================= */
        _loadPOs: function () {
            const aPOs = [];
            this._db.collection("purchaseOrders").get().then(snapshot => {
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

            // Fetch last PO number
            const counterRef = this._db.collection("counters").doc("poNumber");
            const counterSnap = await counterRef.get();

            let lastNumber = 1000; // default starting number
            if (counterSnap.exists) {
                lastNumber = counterSnap.data().lastNumber;
            }

            const newPONumber = lastNumber + 1;

            // Update counter in Firestore
            await counterRef.set({ lastNumber: newPONumber });

            // Set current PO
            oModel.setProperty("/currentPO", {
                poNumber: "PO-" + newPONumber,
                poDate: new Date().toLocaleDateString(),
                items: [],
                totalAmount: 0
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

        /* ================= SAVE PO ================= */
        onSavePO: function () {
            const oModel = this.getView().getModel("po");
            const oPO = oModel.getProperty("/currentPO");

            if (!oPO.items.length) {
                MessageToast.show("Add at least one item");
                return;
            }

            const oBatch = this._db.batch();
            const oCategoryTotals = {};

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

            oBatch.commit().then(() => {
                MessageToast.show("PO Created Successfully");
                this.byId("poDialog").close();
                this._loadPOs();
            });
        },

        /* ================= PO DETAILS ================= */
        onPOPress: function (oEvent) {
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
