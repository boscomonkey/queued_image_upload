/*
 * upload_queue_spec.js
 *
 * Jasmine spec file for the UploadQueue - which utilizes webkit's
 * local SQL database to persist upload information and aid in
 * restarting from crashes.
 */

// Spec helper to check the expected value of a promise
//
var checkPromise = function(fnPromise, expectedVal) {
    var promise = fnPromise();

    var TIMEOUT = 1000;
    var completed = false;
    var returnVal;

    runs(function() {
        promise.done(function(result) {
            returnVal = result;
            completed = true;
        });
    });
    waitsFor(function() {return completed;}, "TIMEOUT", TIMEOUT);
    runs(function() {
        expect(returnVal).toBe(expectedVal);
    });
};

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

    it("should provide utility function for SQL execution", function() {
        q.executeSql("CREATE TABLE test1(id INTEGER);");
        q.executeSql("DROP TABLE test1;");
    });

    it("should report queue length of 0", function() {
        checkPromise(function() { return q.length() }, 0);
    });

    xit("should enqueue");

    xit("should report length of 1");

    xit("should dequeue");

    xit("should report length of 0");

});

