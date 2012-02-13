/*
 * upload_mgr_spec.js
 *
 * Jasmine specs for Upload Manager
 */

describe("UploadMgr", function() {

    var runCount = 0;
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

    describe("#submit", function() {
        it("should queue to DB with 'callbackKey' and return handler (a la 'init' to let clients attach callbacks", function() {

            var key = "callbackKey1";

            var submitAndQuery = function() {
                var dfd = $.Deferred();
                var q = new UploadQueue();
                q.length().done(function(beforeLen) {
                    mgr.submit(
                        key,
                        "file:///tmp/dummy.jpg", "dummy1.jpg",
                        32.32, -120.12,
                        40, '{"device":666}'
                    ).done(function(handler) {

                        console.log("handler", handler);

                        q.length().done(function(afterLen) {
                            dfd.resolve({
                                beforeLen: beforeLen,
                                handler: handler,
                                afterLength: afterLen
                            });
                        });
                    });
                });

                return dfd.promise();
            };

            testPromise(
                submitAndQuery(),
                function(obj) {
                    expect(obj.beforeLen).toBe(0);
                    expect(obj.handler.key).toBe(key);
                    expect(typeof obj.handler.addListener).toBe("function");
                    expect(obj.afterLength).toBe(1);
                }
            );
        });
    });

    // spec #init after #submit so that we have some data in the DB
    describe("#init", function() {
        it("should enumerate item handlers (exposes 'callbackKey') to let clients attach callbacks", function() {
            expect(true).toBe(false);
        });
    });

    describe("#ping", function() {
        it("should check for expired queued entries", function() {
            expect(true).toBe(false);
        });

        it("should 'touch' expired queued entries", function() {
            expect(true).toBe(false);
        });

        it("should fire off uploads", function() {
            expect(true).toBe(false);
        });

        it("should 'mark' successful uploads and fire event", function() {
            expect(true).toBe(false);
        });

        it("should 'requeue' failed uploads", function() {
            expect(true).toBe(false);
        });
    });

});
