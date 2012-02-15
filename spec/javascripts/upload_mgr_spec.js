/*
 * upload_mgr_spec.js
 *
 * Jasmine specs for Upload Manager
 */

describe("UploadMgr", function() {

    var mgr;
    var key = "callbackKey1";
    var item;           // item added by the first submit beforeEach

    beforeEach(function() {
        mgr = new UploadMgr();
    });

    describe("basic behavior", function() {
        it("should instantiate properly", function() {
            expect(mgr).toBeDefined();
        });

        it("defines class constants", function() {
            expect(UploadMgr.STATUS.QUEUED).toBe("QUEUED");
            expect(UploadMgr.STATUS.UPLOADING).toBe("UPLOADING");
            expect(UploadMgr.STATUS.DONE).toBe("DONE");
        });

        it("exposes 'ttl' property", function() {
            expect(mgr.ttl).toBe(600000);
        });
    });

    describe("#submit", function() {
        it("should queue to DB with 'callbackKey' and return item (a la 'init' to let clients attach callbacks", function() {

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
        var nextQueued;
        var expiredItem;

        it("checks for expired uploads returns none", function() {
            var promise = mgr.getExpiredUploads();

            testPromise(
                promise,
                function(emptyArray) {
                    expect(emptyArray.length).toBe(0);
                }
            );
        });

        it("should find next queued", function() {
            // find the next queued
            var promise = mgr.getNextQueued();

            testPromise(
                promise,
                function(oneItem) {
                    expect(oneItem.key).toBe(key);

                    // stash item for next spec
                    nextQueued = oneItem;
                }
            );
        });

        it("should fire off uploads", function() {
            // mock a successful upload
            FileTransferMock.enableMockUpload(true);
            spyOn(FileTransfer.prototype, "upload").andCallThrough();

            var promise = mgr.upload(nextQueued.id);
            testPromise(
                promise,
                function(doneItem) {
                    expect(FileTransfer.prototype.upload).toHaveBeenCalled();

                    expect(doneItem.id).toBe(nextQueued.id);
                    expect(doneItem.state).
                        toBe(UploadMgr.STATUS.DONE);
                }
            );
        });

        it("should find expired queued entries", function() {
            // age the one item in the database os that it's older than TTL
            var ageIt = function() {
                var dfd = $.Deferred();

                var q = new UploadQueue();
                q.executeSql(
                    "UPDATE uploads SET updated_at=?",
                    [new Date() - mgr.ttl - 1]
                ).done(function(sqlResult) {
                    mgr.getExpiredUploads().done(function(expiredRows) {
                        dfd.resolve(expiredRows);
                    });
                });

                return dfd.promise();
            };

            testPromise(ageIt(), function(expiredRows) {
                expect(expiredRows.length).toBe(1);

                console.log("expiredRows", expiredRows);

                // cache for next spec
                expiredItem = expiredRows[0];
            });
        });

        it("should 'touch' expired queued entries", function() {
            testPromise(
                mgr.touch(expiredItem.id),
                function(touchedItem) {
                    expect(touchedItem.state).
                        toBe(UploadMgr.STATUS.QUEUED);
                    expect(Date.parse(touchedItem.updated_at)).
                        toBeGreaterThan(expiredItem.updated_at);
                }
            );
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
