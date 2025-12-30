sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "store/util/firebase"
], function (Controller, JSONModel, Firebase) {
    "use strict";

    return Controller.extend("store.controller.Dashboard", {

        onInit: function () {
            this._db = Firebase.init();

            const oModel = new JSONModel({
                categoryTotals: [],
                lowStockItems: [],
                profitTrend: []   // ✅ FOR CHART
            });

            this.getView().setModel(oModel, "dashboard");
            this._loadDashboardData();
        },

        _loadDashboardData: async function () {
            const oModel = this.getView().getModel("dashboard");

            const categoryMap = {};
            const lowStock = [];
            const profitMap = {}; // 🔥 PERIOD → PROFIT

            /* ---------- PURCHASE ORDERS ---------- */
            const poSnap = await this._db.collection("purchaseOrders").get();
            poSnap.forEach(doc => {
                const d = doc.data();
                if (d.categoryTotals) {
                    Object.keys(d.categoryTotals).forEach(cat => {
                        categoryMap[cat] ??= {
                            category: cat,
                            purchase: 0,
                            sales: 0,
                            profit: 0
                        };
                        categoryMap[cat].purchase += d.categoryTotals[cat];
                    });
                }
            });

            /* ---------- SALES ORDERS ---------- */
            const soSnap = await this._db.collection("salesOrders").get();
            soSnap.forEach(doc => {
                const d = doc.data();
                const parts = d.soDate.split("/"); // ["29", "12", "2025"]
                const day = parseInt(parts[0], 10);
                const month1 = parseInt(parts[1], 10) - 1; // JS months are 0-based
                const year = parseInt(parts[2], 10);


                const month = `${year}-${String(month1 + 1).padStart(2, "0")}`; // e.g., 2025-12
                const quarter = `${year}-Q${Math.floor(month1 / 3) + 1}`; // e.g., 2025-Q4


                if (d.categoryTotals) {
                    Object.keys(d.categoryTotals).forEach(cat => {
                        categoryMap[cat] ??= {
                            category: cat,
                            purchase: 0,
                            sales: 0,
                            profit: 0
                        };
                        categoryMap[cat].sales += d.categoryTotals[cat];
                    });
                }

                // ✅ PROFIT AT ITEM LEVEL (BEST PRACTICE)
                d.items.forEach(i => {
                    const price = Number(i.price) || 0;
                    const cost = Number(i.cost) || 0;
                    const qty = Number(i.qty) || 0;

                    const profit = (price - cost) * qty;

                    // category profit
                    categoryMap[i.category].profit += profit;


                    // period profit
                    profitMap[month] = (profitMap[month] || 0) + profit;
                    profitMap[quarter] = (profitMap[quarter] || 0) + profit;
                    profitMap[year] = (profitMap[year] || 0) + profit;
                });
            });

            /* ---------- LOW INVENTORY ---------- */
            const invSnap = await this._db.collection("inventory").get();
            invSnap.forEach(doc => {
                const d = doc.data();
                if (d.stock < 50) {
                    lowStock.push({
                        name: d.name,
                        category: d.category,
                        quantity: d.stock
                    });
                }
            });

            const aSummary = Object.values(categoryMap);

            /* ---------- PROFIT HEAT ---------- */
            aSummary.forEach(c => {
                if (c.profit >= 5000) {
                    c.profitState = "Success";
                    c.profitStatus = "High Profit";
                } else if (c.profit >= 1000) {
                    c.profitState = "Warning";
                    c.profitStatus = "Low Margin";
                } else {
                    c.profitState = "Error";
                    c.profitStatus = "Loss / Very Low";
                }
            });

            /* ---------- PROFIT TREND DATA ---------- */
            const profitTrend = Object.keys(profitMap)
                .sort()
                .map(k => ({
                    period: k,
                    profit: profitMap[k]
                }));

            // ✅ SET MODEL DATA
            oModel.setProperty("/categoryTotals", aSummary);
            oModel.setProperty("/lowStockItems", lowStock);
            oModel.setProperty("/profitTrend", profitTrend);
        }
    });
});
