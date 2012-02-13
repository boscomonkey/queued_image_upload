/*
 * upload_mgr_spec.js
 *
 * Jasmine specs for Upload Manager
 */

describe("UploadMgr", function() {

    var mgr;
    var item;           // item added by the first submit beforeEach

    beforeEach(function() {
        mgr = new UploadMgr();
    });

/*
    afterEach(function () {
        var q = new UploadQueue();
        q.empty();
    });
*/

    it("should instantiate properly", function() {
        expect(mgr).toBeDefined();
    });

    it("exposes 'ttl' property", function() {
        expect(mgr.ttl).toBe(600000);
    });

    describe("#submit", function() {
        it("should queue to DB with 'callbackKey' and return item (a la 'init' to let clients attach callbacks", function() {

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
                        item = handler;         // suite scoped variable

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
        it("should enumerate items (exposing 'addListener') to let clients attach callbacks", function() {
            testPromiseValue(
                mgr.init(function(item) { console.log("item", item) }),
                1
            );
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

    describe("clean up", function() {
        it("drop table for next run", function() {
            testPromise(
                mgr.queue.executeSql("DROP TABLE uploads;"),
                function(sqlResult) {
                    expect(sqlResult.rowsAffected).toBe(0.0);
                }
            );
        });
    });

});
