/*
Postgres Storage module for my bot that uses pg library and uses TLS

The API requirements for storage modules is you must provide 3 objects, users, teams and channels.  Each must provide 4 methods, save, get, delete and all
*/

var pg = require('pg');

module.exports = function(config) {
  if (!config) {
    config = {
      user: config.user || process.env.BOTKIT_STORAGE_POSTGRES_USER || 'botkit',
      database: config.database || process.env.BOTKIT_STORAGE_POSTGRES_DATABASE || 'botkit',
      password: config.password || process.env.BOTKIT_STORAGE_POSTGRES_PASSWORD || 'botkit',
      host: config.host || process.env.BOTKIT_STORAGE_POSTGRES_HOST || 'localhost',
      port: config.port || process.env.BOTKIT_STORAGE_POSTGRES_PORT || '5432',
      max: config.maxClients || process.env.BOTKIT_STORAGE_POSTGRES_MAX_CLIENTS || '10',
      idleTimeoutMillis: config.idleTimeoutMillis || process.env.BOTKIT_STORAGE_POSTGRES_IDLE_TIMEOUT_MILLIS || '30000',
      ssl: config.ssl || process.env.BOTKIT_STORAGE_POSTGRES_SSL || true,
    };
  }

  function initClient(config) {
    console.log('pg_storage: connecting to database '+config.database);

    var pool = new pg.Client(config);
    pool.connect();
    /* Check whether the slack_bot tables exists */
    var res = pool.query(`CREATE TABLE IF NOT EXISTS botkit_channels (
        id char(50) NOT NULL PRIMARY KEY,
        json TEXT NOT NULL
      )`)
      .then(() => pool.query(`CREATE TABLE IF NOT EXISTS botkit_teams (
        id char(50) NOT NULL PRIMARY KEY,
        json TEXT NOT NULL
      )`))
      .then(() => pool.query(`CREATE TABLE IF NOT EXISTS botkit_users (
        id char(50) NOT NULL PRIMARY KEY,
        json TEXT NOT NULL
      )`));

    // Setup error handler
    pool.on('error', function(err, client) {
      console.log('pg_storage: error: ', err.message, err.stack);
    });
    return pool;
  };

  function db_get(pool, table, id, cb) {
    console.log(`pg_storage: SELECT json from ${table} where id = ${id}`);
    pool.query(`SELECT json from ${table} where id = $1`, [id], function (err, result) {
      if (result.rows.length === 0) {
        console.log("pg_storage: 0 rows");
        cb({displayName: 'NotFound'}, null);
      } else {
        console.log("pg_storage: result = "+result.rows[0].json);
        cb(err, JSON.parse(result.rows[0].json))
      }
    });
  }

  function db_save(pool, table, obj, cb) {
    console.log(`pg_storage: INSERT into ${table} (${obj.id}, ${JSON.stringify(obj)}`);

    pool.query(`INSERT INTO ${table} (id, json)
    VALUES ($1, $2)
    ON CONFLICT(id) DO
    UPDATE SET json = EXCLUDED.json;`, [obj.id, JSON.stringify(obj)], cb);
  }

  function db_delete(pool, table, id, cb) {
    console.log(`pg_storage: DELETE from ${table} ${id}`);
    pool.query(`DELETE FROM ${table} WHERE id = $1`, [id], cb);
  }

  function db_all(pool, table, cb) {
    pool.query(`SELECT (json) from ${table}`, function (err, result) {
      cb(err, result.rows.map(x => JSON.parse(x.json)));
    });
  }

  var pgClient = initClient(config);



   var storage = {
     teams: {
      get: function(id, cb) {
        db_get(pgClient, "botkit_teams", id, cb);
      },
      save: function(obj, cb) {
        db_save(pgClient, "botkit_teams", obj, cb);
      },
      delete: function(id, cb) {
        db_delete(pgClient, "botkit_teams", id, cb);
      },
      all: function(cb) {
        db_all(pgClient, "botkit_teams", cb);
      }
    },
    users: {
      get: function(id, cb) {
        db_get(pgClient, "botkit_users", id, cb);
      },
      save: function(obj, cb) {
        db_save(pgClient, "botkit_users", obj, cb);
      },
      delete: function(id, cb) {
        db_delete(pgClient, "botkit_users", id, cb);
      },
      all: function(cb) {
        db_all(pgClient, "botkit_users", cb);
      }
    },
    channels: {
      get: function(id, cb) {
        db_get(pgClient, "botkit_channels", id, cb);
      },
      save: function(obj, cb) {
        db_save(pgClient, "botkit_channels", obj, cb);
      },
      delete: function(id, cb) {
        db_delete(pgClient, "botkit_channels", id, cb);
      },
      all: function(cb) {
        db_all(pgClient, "botkit_channels", cb);
      }

    }
  };

  return storage;
};
