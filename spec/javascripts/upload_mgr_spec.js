/*
 * upload_mgr_spec.js
 *
 * Jasmine specs for Upload Manager
 */

describe("UploadMgr", function() {

    var mgr;

    beforeEach(function() {
        mgr = new UploadMgr();
    });

    it("should instantiate properly", function() {
        expect(mgr).toBeDefined();
    });

    it("exposes 'ttl' property", function() {
        expect(mgr.ttl).toBe(600000);
    });

});
