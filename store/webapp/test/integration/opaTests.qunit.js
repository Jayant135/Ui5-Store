/* global QUnit */
QUnit.config.autostart = false;

sap.ui.require(["store/test/integration/AllJourneys"
], function () {
	QUnit.start();
});
