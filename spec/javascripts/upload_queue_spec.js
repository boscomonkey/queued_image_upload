/*
 * upload_queue_spec.js
 *
 * Jasmine spec file for the UploadQueue - which utilizes webkit's
 * local SQL database to persist upload information and aid in
 * restarting from crashes.
 */

describe("UploadQueue", function() {

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

    it("should create local SQL database table", function() {
        var p = q.dbParams();
        var db = openDatabase(
            p.shortName, p.version, p.displayName, p.maxSize);
        expect(db).toBeDefined();

        db.executeSql = runMethod;
        db.executeSql("CREATE TABLE test1(id INTEGER);", []);
        db.executeSql("DROP TABLE test1;", []);
    });

    it("should provide utility function for SQL execution", function() {
        q.executeSql("CREATE TABLE test1(id INTEGER);");
        q.executeSql("DROP TABLE test1;");
    });

    it("raw query for length", function() {
        var promise = q.executeSql("SELECT COUNT(*) FROM uploads;");
        var completed = false;
        var length = -1;

        runs(function() {
            promise.done(function(resultSet) {
                length = resultSet.rows.item(0)["COUNT(*)"]
                completed = true;
            });

            promise.fail(function() {
                expect(promise).toBeUndefined();
                completed = true;
            });
        });

        waitsFor(function() {return completed;}, "TIMEOUT", 1000);

        runs(function() {
            expect(length).toBe(0);
        });
    });

    it("should report queue length of 0", function() {
        var promise = q.length();

        var TIMEOUT = 1000;
        var completed = false;
        var len = -1;

        runs(function() {
            promise.done(function(result) {
                len = result;
                completed = true;
            });
        });
        waitsFor(function() {return completed;}, "TIMEOUT", TIMEOUT);
        runs(function() {
            expect(len).toBe(0);
        });
    });

    xit("should enqueue");

    xit("should report length of 1");

    xit("should dequeue");

    xit("should report length of 0");

});

