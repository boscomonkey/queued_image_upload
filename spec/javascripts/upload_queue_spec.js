/*
 * upload_queue_spec.js
 *
 * Jasmine spec file for the UploadQueue - which utilizes webkit's
 * local SQL database to persist upload information and aid in
 * restarting from crashes.
 */

// Spec helper to pass the "done" value of a promise to a test
// function.
//
// fnTest = function(promisedValue)
//
var testFunc = function(promise, fnTest) {
    var TIMEOUT = 1000;
    var completed = false;
    var testVal;

    runs(function() {
        promise.done(function(result) {
            testVal = result;
            completed = true;
        });
    });
    waitsFor(function() {return completed;}, "TIMEOUT", TIMEOUT);
    runs(function() {
        fnTest(testVal);
    });
};

// Spec helper to check the expected value of a promise
//
var testValue = function(promise, expectedVal) {
    testFunc(
        promise,
        function(testValue) {
            expect(testValue).toBe(expectedVal);
        }
    );
};

/* Console command line helper that pushes the resolved value of a
 * promise onto the Array receiver. Returns the array for chaining.
   q = new UploadQueue();
   aa = [];
   aa.pushPromise(q.length());
 */
Array.prototype.pushPromise = function(promise) {
    var array = this;
    promise.done(function(x) { array.push(x) });
    return array;
};

// Finally, the actual specs for UploadQueue itself
//
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
        testValue(q.length(), 0);
    });

    it("should queue and report new length of 1", function() {
        q.enqueue("file:///var/app/dummy/photo1.jpg",
                  "photo1.jpg",
                  38.473469, -121.821177,
                  40,
                '{"device":666,"targetWidth":1536,"targetHeight":2048}');
        testValue(q.length(), 1);
    });

    it("should take optional 'state' argument in length()", function() {
        testValue(q.length("UPLOADING"), 0);
    });

    it("should count 'DONE' entries as 0", function() {
        testValue(q.length("DONE"), 0);
    });

    it("should count 'QUEUED' entries as 1", function() {
        testValue(q.length("QUEUED"), 1);
    });

    it("should return 'QUEUED' entries", function() {
        testFunc(q.find_all_by_status("QUEUED"), function(resultRows) {
            expect(resultRows.length).toBe(1);

            var item = resultRows.item(0);
            expect(item.fname).toBe("photo1.jpg");
        });
    });

    it("should empty table of rows for testing", function() {
        testValue(q.empty(), 1);        // number of rows dumped
        testValue(q.length(), 0);
    });

    xit("should dequeue");

    xit("should report length of 0");

});

