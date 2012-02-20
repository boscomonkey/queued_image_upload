/*
 * upload_mgr_spec.js
 *
 * Jasmine specs for Upload Manager
 */

describe("UploadMgr", function() {

    var mgr;
    var key = "callbackKey1";
    var submittedItem;          // item added by the first submit beforeEach

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
                        q.length().done(function(afterLen) {
                            dfd.resolve({
                                beforeLen: beforeLen,
                                handler: handler,
                                afterLength: afterLen
                            });
                        });

                        // stash submitted item for next spec
                        submittedItem = handler;
                    });
                });

                return dfd.promise();
            };

            testPromise(
                submitAndQuery(),
                function(obj) {
                    expect(obj.beforeLen).toBe(0);
                    expect(obj.handler.key).toBe(key);
                    expect(obj.afterLength).toBe(1);
                }
            );
        });
    });

    // spec #init after #submit so that we have some data in the DB
    describe("#init", function() {
        it("should enumerate items to attach callbacks", function() {
            var testInit = function() {
                var dfd = $.Deferred();

                mgr.init(function(item) {
                    mgr.addEventHandler(
                        item,
                        function(item, event) {
                            dfd.resolve({item:item, event:event});
                        }
                    );
                });

                return dfd.promise();
            };

            testPromise(
                testInit(),
                function(obj) {
                    expect(obj.item.id + 0.11).toBe(submittedItem.id + 0.11);
                    expect(obj.event).toBe("INIT");
                }
            );
        });
    });

    describe("#ping", function() {
        var nextQueued;
        var expiredItem;

        it("checks for active uploads", function() {
            var promise = mgr.getActiveUploads();

            testPromise(promise, function(emptyArray) {
                expect(emptyArray.length).toBe(0);
            });
        });

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

                    // stash item for upload spec
                    nextQueued = oneItem;
                }
            );
        });

        it("should fire off uploads successfully", function() {
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

        it("should requeue unsuccessful uploads", function() {
            // mock a successful upload
            FileTransferMock.enableMockUpload(false);
            spyOn(FileTransfer.prototype, "upload").andCallThrough();

            var promise = mgr.upload(nextQueued.id);
            testPromise(
                promise,
                function(requeuedItem) {
                    expect(FileTransfer.prototype.upload).toHaveBeenCalled();

                    expect(requeuedItem.id).toBe(nextQueued.id);
                    expect(requeuedItem.state).
                        toBe(UploadMgr.STATUS.QUEUED);
                },
                "Assert Negative Scenario"
            );
        });

        it("should find expired queued entries", function() {
            // age the one item in the database so it's older than TTL
            var ageIt = function() {
                var dfd = $.Deferred();

                var q = new UploadQueue();
                q.executeSql(
                    "UPDATE uploads SET updated_at=?, state=? WHERE id=?",
                    [new Date() - mgr.ttl - 1,
                     UploadMgr.STATUS.UPLOADING,
                     nextQueued.id]
                ).done(function(sqlResult) {

                    mgr.getExpiredUploads().
                        done(function(expiredRows) {

                            dfd.resolve(expiredRows);
                        });
                });

                return dfd.promise();
            };

            testPromise(ageIt(), function(expiredRows) {
                expect(expiredRows.length).toBe(1);

                // cache for next spec
                expiredItem = expiredRows[0];
            });
        });

        xit("should 'touch' expired queued entries", function() {
            testPromise(
                mgr.touch(expiredItem.id),
                function(touchedItem) {

                    console.log("TOUCHED ITEM", touchedItem);

                    expect(touchedItem.state).
                        toBe(UploadMgr.STATUS.UPLOADING);
                    expect(Date.parse(touchedItem.updated_at)).
                        toBeGreaterThan(expiredItem.updated_at);
                }
            );
        });

        it("combine all previous methods into working 'ping'", function() {
            var promise = mgr.ping();

            // expecting false because FileTransfer is configured to
            // always fail at this point
            testPromiseValue(promise, false);
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
