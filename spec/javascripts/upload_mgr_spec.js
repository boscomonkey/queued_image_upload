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

    afterEach(function () {
        var q = new UploadQueue();
        q.empty();
    });

    it("should instantiate properly", function() {
        expect(mgr).toBeDefined();
    });

    it("exposes 'ttl' property", function() {
        expect(mgr.ttl).toBe(600000);
    });

    it("provides 'submit' method that queues to DB", function() {
        var submitAndQuery = function() {
            var dfd = $.Deferred();

            mgr.submit(
                "file:///tmp/dummy.jpg", "dummy1.jpg",
                32.32, -120.12,
                40, '{"device":666}'
            ).
                done(function(nRows) {

                    var q = new UploadQueue();
                    q.length().

                        done(function(len) {
                            dfd.resolve({returned: nRows, expected: len});
                        });
                });

            return dfd.promise();
        };

        testPromise(
            submitAndQuery(),
            function(obj) {
                expect(obj.returned).toBe(1);
                expect(obj.expected).toBe(1);
            }
        );
    });

});
