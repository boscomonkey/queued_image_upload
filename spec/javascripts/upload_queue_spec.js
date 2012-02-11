/*
 * upload_queue_spec.js
 *
 * Jasmine spec file for the UploadQueue - which utilizes webkit's
 * local SQL database to persist upload information and aid in
 * restarting from crashes.
 */

describe("UploadQueue", function() {

    var fnNoOp = function () {};
    var q;

    beforeEach(function() {
        q = new UploadQueue();
    });

    it("should instantiate properly", function() {
        expect(q).toBeDefined();
    });

    it("should return database parameters", function() {
        var params = q.dbParams();
        expect(params.shortName).toBeDefined();
        expect(params.version).toBe("1.0");
        expect(params.displayName).toBeDefined();
        expect(params.maxSize).toBeDefined();
    });

    it("should provide utility function for SQL execution", function() {
        var create, drop1;

        runs(function() {
            create = q.executeSql("CREATE TABLE IF NOT EXISTS test1(id INT);");
            create.done(function() {
                drop1 = q.executeSql("DROP TABLE test1;");
            });
        });

        waitsFor(function() { return drop1 !== undefined }, "TIMEOUT", 500);

        runs(function() {
            expect(create.isResolved()).toBe(true);
            expect(drop1.isResolved()).toBe(true);
        });
    });

    it("should provide utility function for SQL execution, redux", function() {
        var drop;

        runs(function() {
            drop = q.executeSql("DROP TABLE test1;");
        });

        waitsFor(function() { return drop !== undefined }, "TIMEOUT", 5000);

        runs(function() {
            expect(drop.isResolved()).toBe(false);
        });
    });

    it("should report queue length of 0", function() {
        testPromiseValue(q.length(), 0);
    });

    it("should queue and report new length of 1", function() {
        testPromise(
            q.enqueue("file:///var/app/dummy/photo1.jpg",
                      "photo1.jpg",
                      38.473469, -121.821177,
                      40,
                      '{"device":666,"targetWidth":1536,"targetHeight":2048}'),
            function(sqlResult) {
                expect(typeof sqlResult.insertId).toBe("number");
            }
        );
        testPromiseValue(q.length(), 1);
    });

    it("should take optional 'state' argument in length()", function() {
        testPromiseValue(q.length("UPLOADING"), 0);
    });

    it("should count 'DONE' entries as 0", function() {
        testPromiseValue(q.length("DONE"), 0);
    });

    it("should count 'QUEUED' entries as 1", function() {
        testPromiseValue(q.length("QUEUED"), 1);
    });

    it("should return 'QUEUED' entries", function() {
        testPromise(q.find_all_by_status("QUEUED"), function(resultRows) {
            expect(resultRows.length).toBe(1);

            var item = resultRows.item(0);
            expect(item.fname).toBe("photo1.jpg");
        });
    });

    it("should return zero 'QUEUED' entries older than 10 min", function() {
        var tenMinutesAgo = new Date() - 10 * 60 * 1000;
        testPromise(
            q.find_all_by_status("QUEUED", tenMinutesAgo),
            function(resultRows) {
                expect(resultRows.length).toBe(0);
            }
        );
    });

    it("should return entries in reverse chron order", function() {
        // make the existing entry super young
        var future = new Date() + 1000;
        testPromise(
            q.executeSql("UPDATE uploads SET updated_at=?", [future]),
            function(sqlResult) {
                expect(sqlResult.rowsAffected).toBe(1);
            }
        );
        // insert a new entry but it will still be older than the first entry
        testPromise(
            q.enqueue("file:///tmp/photo2.jpg",
                      "photo2.jpg",
                      33, -122,
                      40,
                      '{"device":666,"targetWidth":400,"targetHeight":300}'),
            function(sqlResult) {
                expect(sqlResult.rowsAffected).toBe(1);
            }
        );
        // if we sort in reverse chron, then the first item in the
        // result should be "photo2.jpg"
        testPromise(
            q.find_all_by_status("QUEUED"),
            function(resultRows) {
                expect(resultRows.length).toBe(2);
                expect(resultRows.item(0).fname).toBe("photo2.jpg");
            }
        );
    });

    it("should update status of item given its ID", function() {
        // fn returns a promise of nested sequential operations
        var fnPromise = function() {
            var dfd = $.Deferred();

            // get ID of first queued item
            q.find_all_by_status("QUEUED").done(function(rows) {
                var itemId = rows.item(0).id;

                expect(itemId).toBe(2);
                expect(rows.length).toBe(2);

                // NEST: update status of first item
                q.updateStatus(itemId, "CRAZY").done(function(sqlResult) {
                    expect(sqlResult.rowsAffected).toBe(1);

                    // NEST: get number of "CRAZY" entries
                    q.length("CRAZY").done(function(len) {
                        dfd.resolve(len);
                    });
                });
            });

            return dfd.promise();
        };

        // final check
        testPromise(
            fnPromise(),
            function(length) {
                expect(length).toBe(1);
            }
        );
    });

    it("should empty table of rows for testing", function() {
        testPromiseValue(q.empty(), 2);         // number of rows dumped
        testPromiseValue(q.length(), 0);
    });

    xit("should report length of 0");

});

