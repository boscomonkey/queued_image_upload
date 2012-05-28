/*
 * upload_queue.js
 */

var UploadQueue = function() {

    this.params = {
        shortName: 'UPLOAD_QUEUE_DB',
        version: '1.0',
        displayName: 'Upload Queue Database',
        maxSize: 1 * 1024 * 1024
    };
    this.db = openDatabase(this.params.shortName, this.params.version,
                           this.params.displayName, this.params.maxSize);

    // create table if doesn't exist
    this.executeSql("CREATE TABLE IF NOT EXISTS uploads("
                    + " id INTEGER NOT NULL PRIMARY KEY,"
                    + " key NVARCHAR(255) NOT NULL,"
                    + " imageUri NVARCHAR(255) NOT NULL,"
                    + " fname NVARCHAR(255) NOT NULL,"
                    + " lat FLOAT,"
                    + " lon FLOAT,"
                    + " quality INTEGER,"
                    + " payload TEXT,"
                    + " state VARCHAR(32) NOT NULL,"
                    + " updated_at TIME NOT NULL"
                    + ");"
                   );
}

UploadQueue.prototype.dbParams = function() {
    return this.params;
};

// Drops the internal table
//
UploadQueue.prototype.drop = function() {
    return this.executeSql("DROP TABLE uploads;");
}

// Empties the queue and returns number of items dumped
//
UploadQueue.prototype.empty = function() {
    return this.executeSql(
        "DELETE FROM uploads;",
        [],
        function(tx, resultSet) {
            return resultSet.rowsAffected;
        }
    );
};

UploadQueue.prototype.enqueue = function(key,
                                         imageUri, fname, lat, lon,
                                         quality, payload) {
    var self = this;
    var dfd = $.Deferred();

    this.executeSql(
        "INSERT INTO uploads"
            + " (key,imageUri,fname,lat,lon,quality,payload,state,updated_at)"
            + " VALUES (?, ?, ?, ?, ?, ?, ?, 'QUEUED', ?)",
        [key, imageUri, fname, lat, lon, quality, payload, new Date()]
    ).done(function(sqlresult) {
        var id = sqlresult.insertId;

        self.find_by_id(id).done(function(found) {
            dfd.resolve(found);
        });
    });

    return dfd.promise();
};

//            sql       - SQL statement string
// (optional) data      - array of data for ? placeholders in SQL
// (optionaL) fnResult(transaction, resultSet) extracts data from resultSet
//
UploadQueue.prototype.executeSql = function(sql, data, fnResult) {
    var self = this;
    var dfd = $.Deferred();
    var data = data || [];
    var extractAnswer = fnResult ? fnResult : function(tx, r) {return r};

    this.db.transaction(function(transaction) {
        transaction.executeSql(
            sql,
            data,
            function(transaction, resultSet) {
                dfd.resolve(extractAnswer(transaction, resultSet));
            },
            function(transaction, error) {
                var heading = "UPLOAD_QUEUE ERROR";
                console.log(heading
                            + ": "
                            + error.message
                            + " (" + error.code + ")"
                            + " - "
                            + '"' + sql + '"'
                            ,
                            arguments);
                dfd.reject(error);
                return true;            // rollback
            }
        );
    });

    return dfd.promise();
};

// Return all rows for a status. "timestamp" is optional; if present,
// returns all rows older than "timestamp".
UploadQueue.prototype.find_all_by_status = function(status, hiTime, loTime) {
    var sql, data;

    if (loTime) {
        sql = "SELECT * FROM uploads WHERE state=? AND updated_at<? AND updated_at>?";
        data = [status, hiTime, loTime];
    } else if (hiTime) {
        sql = "SELECT * FROM uploads WHERE state=? AND updated_at<?";
        data = [status, hiTime];
    } else {
        sql = "SELECT * FROM uploads WHERE state=?";
        data = [status];
    }

    return this.executeSql(
        sql + " ORDER BY updated_at;",
        data,
        function(tx, resultSet) {
            var arr = [];
            for (var i = 0; i < resultSet.rows.length; i++) {
                arr.push(resultSet.rows.item(i));
            }
            return arr;
        }
    );
};

// Returns the row (or null) identified by id
//
UploadQueue.prototype.find_by_id = function(id) {
    return this.executeSql(
        "SELECT * FROM uploads WHERE id=?;",
        [id],
        function(tx, sqlResult) {
            return sqlResult.rows.length > 0 ? sqlResult.rows.item(0) : null;
        }
    );
};

UploadQueue.prototype.length = function(state) {
    var sql = state ?
        "SELECT COUNT(*) FROM uploads WHERE state=?" :
        "SELECT COUNT(*) FROM uploads";
    var data = state ? [state] : [];

    return this.executeSql(sql, data,
        function(tx, resultSet) {
            return resultSet.rows.item(0)["COUNT(*)"];
        }
    );
};

// Returns item updated or null
//
UploadQueue.prototype.updateStatus = function(id, status) {
    var self = this;
    var dfd = $.Deferred();

    this.executeSql(
        "UPDATE uploads SET state=?, updated_at=? WHERE id=?",
        [status, new Date(), id]
    ).
        done(function(result) {
            // NEST: return item
            self.find_by_id(id).
                done(function(item) {
                    dfd.resolve(item);
                });
        });

    return dfd.promise();
};
