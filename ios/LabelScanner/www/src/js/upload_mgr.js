/*
 * upload_mgr.js
 *
 * Upload Manager responsible for queueing, timing out, and retrying
 * uploads. Uses S3Uploader for uploading and UploadQueue for queueing
 * uploads.
 *
 * Files are uploaded one at a time to maximize the chances of success
 * in low bandwidth situation.
 *
 * Failed uploads are moved to the back of the queue to let others
 * have a chance.
 *
 * Uploads that have been happening for "ttl" minutes are considered
 * dead and moved to the back of the queue.
 *
 * Provides "submit" method to submit data to be uploaded.
 *
 * Provides "ping" method to let external processes (page change, app
 * start/resume/wake, etc) to update state.
 *
 * Exposes changeable "ttl" property that specifies the number of
 * milliseconds considered as a timeout.
 */

// Create an Upload Manager with an optional image uploader. If the
// uploader is omitted, then the default uploader is used.
//
var UploadMgr = function(imageUploader) {
    this.debug = false;
    this.imageUploader = imageUploader ? imageUploader : new ImageUploader();
    this.ttl = 10 * 60 * 1000;

    //// private

    this.itemCallbacks = {};    // maps ID to items (to get to callbacks)
    this.queue = new UploadQueue();
};

// Class constants
//
UploadMgr.EVENT = {
    INIT: "INIT",
    STATUS_CHANGE: "STATUS_CHANGE"
};
UploadMgr.STATUS = {
    QUEUED: "QUEUED",
    UPLOADING: "UPLOADING",
    DONE: "DONE"
};

// Add event handler to item identified by id.
// fnOnEvent = function(item, event) {...}
//
UploadMgr.prototype.addEventHandler = function(item, fnOnEvent) {
    this.initItemCallbacks(item);
    this.itemCallbacks[item.id].push(fnOnEvent);
};


// Enumerates over each item in the queue and pass to callback - gives
// the callback an opportunity to build a DOM and register event
// listener via "addListener".
//
// Returns promise of total number of items found.
//
UploadMgr.prototype.init = function(fnEach) {
    var mgr = this;
    var promise = mgr.queue.executeSql("SELECT * FROM uploads;");
    var dfd = $.Deferred();

    console.log(":::MGR#init");

    promise.done(function(sqlResult) {
        var i = 0;
        for (; i < sqlResult.rows.length; i++) {
            var item = sqlResult.rows.item(i);
            mgr.initItemCallbacks(item);
            fnEach(item);

            // fire change on next event loop
            mgr.onNextEventLoop(
                (function(x) {
                    return function() {
                        mgr.fireChange(x, UploadMgr.EVENT.INIT);
                    };
                })(item)
            );
        }
        dfd.resolve(i);
    });

    return dfd.promise();
};

// Pings the Manager to do the next thing. Returns true if nothing
// fails.
//
// - Search for active uploads
// - If any exists, exit right now.
// - Search for expired uploads
// - If any exists, requeue
// - Search for queued upload
// - If any exists, upload
//
UploadMgr.prototype.ping = function() {
    var mgr = this;
    var dfd = $.Deferred();

    console.log(":::MGR#ping");

    mgr.getActiveUploads().done(function(activeItems) {

        console.log(":::ACTIVE UPLOADS = " + activeItems.length);

        if (activeItems.length > 0) {
            // if any active uploads exist, stop
            dfd.resolve(true);
        } else {

            // NEST: check for expired uploads
            mgr.getExpiredUploads().done(function(expiredItems) {

                console.log(":::EXPIRED UPLOADS = " + expiredItems.length);

                // if any expired uploads exist, requeue them
                $.each(expiredItems, function(i, item) {
                    mgr.updateStatus(item.id, UploadMgr.STATUS.QUEUED);
                });

                // NEST: for for queued uploads
                mgr.getNextQueued().done(function(item) {

                    console.log(":::QUEUED ITEM = " + JSON.stringify(item));

                    // if exists, then upload
                    if (item) {
                        mgr.upload(item.id).then(
                            function(result) {

                                console.log(":::UPLOAD SUCCESS = "
                                            + JSON.stringify(result));

                                mgr.pingLater();
                                dfd.resolve(true);
                            },
                            function(error) {

                                console.log(":::UPLOAD FAILURE = "
                                            + JSON.stringify(error));

                                mgr.pingLater(1 * 60 * 1000);   // 1 minute
                                dfd.resolve(false);
                            }
                        );
                    } else {
                        dfd.resolve(true);
                    }
                });
            });
        }
    });

    return dfd.promise();
};

// Empties the internal database
//
UploadMgr.prototype.reset = function() {
    return this.queue.drop();
}

// Returns promise of the item added (w/ addListener method)
//
UploadMgr.prototype.submit = function(key,
                                      imageUri, fname,
                                      lat, lon,
                                      quality, payload) {
    var mgr = this;
    var dfd = $.Deferred();

    console.log(":::MGR#submit", arguments);

    this.queue.enqueue(key,
                       imageUri, fname,
                       lat, lon,
                       quality, payload).
        done(function(item) {
            mgr.initItemCallbacks(item);
            dfd.resolve(item);
        });
    return dfd.promise();
};

// "Touch" an item identified by "id" and return it
//
UploadMgr.prototype.touch = function(id) {
    var mgr = this;
    var dfd = $.Deferred();
    var update = this.queue.executeSql(
        "UPDATE uploads SET updated_at=? WHERE id=?",
        [new Date(), id]
    );

    update.done(function(updateResult) {
        mgr.queue.find_by_id(id).
            done(function(touchedItem) {
                dfd.resolve(touchedItem);
            });
    });

    return dfd.promise();
};


////
//// private functions
////


UploadMgr.prototype.initItemCallbacks = function(item) {
    var id = item.id;

    if (this.itemCallbacks[id] === undefined) {
        this.itemCallbacks[id] = [];
    }
};

// Fire all the callbacks for an item'id on an event
//
UploadMgr.prototype.fireChange = function(item, event) {

    if (this.itemCallbacks[item.id]) {
        $.each(
            this.itemCallbacks[item.id],
            function(i, fn) {
                fn(item, event);
            }
        );
    }
};

// Returns Array of active uploads (state = "UPLOADONG", updated_at >
// now - ttl)
//
UploadMgr.prototype.getActiveUploads = function() {
    var hiBound = new Date();
    var loBound = hiBound - this.ttl;
    return this.queue.find_all_by_status(
        UploadMgr.STATUS.UPLOADING, hiBound, loBound);
};

// Returns Array of found items
//
UploadMgr.prototype.getExpiredUploads = function() {
    var hiBound = new Date() - this.ttl;
    return this.queue.find_all_by_status(UploadMgr.STATUS.UPLOADING,
                                         hiBound);
};

// Returns the next queued item; or null, if there isn't any
//
UploadMgr.prototype.getNextQueued = function() {
    var mgr = this;

    return this.queue.executeSql(
        "SELECT * FROM uploads WHERE state=? ORDER BY updated_at;",
        [UploadMgr.STATUS.QUEUED],
        function(tx, sqlResult) {
            return sqlResult.rows.length > 0 ? sqlResult.rows.item(0) : null;
        }
    );
};

// Convenience function that invokes a function on the next event loop
//
UploadMgr.prototype.onNextEventLoop = function(fn) {
    setTimeout(fn, 1);
};

// Invoke ping() some time later; defaults to 1 millisecond if omitted
//
UploadMgr.prototype.pingLater = function(milliseconds) {
    var mgr = this;

    if (undefined === milliseconds) {
        milliseconds = 1;
    }
    setTimeout(function() {mgr.ping()}, milliseconds);
};

// Returns item; also invokes callback that was attached to item with
// (item, status)
//
UploadMgr.prototype.updateStatus = function(id, status) {
    var mgr = this;

    return this.queue.updateStatus(id, status).pipe(
        function(item) {
            mgr.onNextEventLoop(function() {
                mgr.fireChange(item, UploadMgr.EVENT.STATUS_CHANGE);
            });
            return item;
        }
    );
};

// Uploads the item specified by the argument ID. Returns the "DONE"
// item if successful; returns the re-"QUEUED" item otherwise.
//
UploadMgr.prototype.upload = function(id) {
    var mgr = this;
    var dfd = $.Deferred();

    this.updateStatus(id, UploadMgr.STATUS.UPLOADING).
        done(function(item) {

            // NESTED: upload the file
            mgr.imageUploader.upload(item.imageUri, item.fname,
                                     item.lat, item.lon,
                                     item.quality, item.payload).
                done(function(uploadResult) {

                    // NEST: update status to done
                    mgr.updateStatus(id, UploadMgr.STATUS.DONE).
                        done(function(doneItem) {

                            dfd.resolve(doneItem);
                        })
                }).
                fail(function(error) {

                    // NEST: requeue for another try
                    mgr.updateStatus(id, UploadMgr.STATUS.QUEUED).
                        done(function(queuedItem) {

                            dfd.reject(queuedItem);
                        })
                });
        });

    return dfd.promise();
};
