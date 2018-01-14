/*
Postgres Storage module for my bot that uses pg library and uses TLS

The API requirements for storage modules is you must provide 3 objects, users, teams and channels.  Each must provide 4 methods, save, get, delete and all
*/

var pg = require('pg');

module.exports = function(srcConfig) {
  config = {
    user: process.env.BOTKIT_STORAGE_POSTGRES_USER || srcConfig.user || 'botkit',
    database: process.env.BOTKIT_STORAGE_POSTGRES_DATABASE || srcConfig.database || 'botkit',
    password: process.env.BOTKIT_STORAGE_POSTGRES_PASSWORD || srcConfig.password || 'botkit',
    host: process.env.BOTKIT_STORAGE_POSTGRES_HOST || srcConfig.host || 'localhost',
    port: process.env.BOTKIT_STORAGE_POSTGRES_PORT || srcConfig.port || '5432',
    max: process.env.BOTKIT_STORAGE_POSTGRES_MAX_CLIENTS || srcConfig.maxClients || '10',
    idleTimeoutMillis: process.env.BOTKIT_STORAGE_POSTGRES_IDLE_TIMEOUT_MILLIS || srcConfig.idleTimeoutMillis || '30000',
    ssl: process.env.BOTKIT_STORAGE_POSTGRES_SSL || srcConfig.ssl || false,
  };

  function initClient(config) {
    console.log('pg_storage: connecting to database '+config.database);

    var pool = new pg.Pool(config);
    // Setup error handler
    pool.on('error', function(err, client) {
      console.error('pg_storage: error on idle client: ', err.message, err.stack);
      // Probably means a database connection problem.  Simply exit the
      // process, which should then be automatically restarted, to get a new
      // connection.
      process.exit(-1);
    });

    /* Check whether the slack_bot tables exists */
    pool.query(`CREATE TABLE IF NOT EXISTS botkit_instance (
      id char(36) NOT NULL PRIMARY KEY
    )`)
    .then(() => pool.query(`CREATE TABLE IF NOT EXISTS botkit_channels (
      id char(50) NOT NULL PRIMARY KEY,
      json TEXT NOT NULL
    )`))
    .then(() => pool.query(`CREATE TABLE IF NOT EXISTS botkit_teams (
      id char(50) NOT NULL PRIMARY KEY,
      json TEXT NOT NULL
    )`))
    .then(() => pool.query(`CREATE TABLE IF NOT EXISTS botkit_users (
      id char(50) NOT NULL PRIMARY KEY,
      json TEXT NOT NULL
    )`))
    .catch(err => {
      console.error("pg_storage: couldn't initialise tables: " + err);
      process.exit(-1);
    })

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

  function claimInstance(pool, table, instanceId, cb) {
    // Set the instance ID in postgres, and listen for notifications (using
    // postgres NOTIFY/LISTEN that it's changed.  If there's an error doing
    // this, or whenever a notification is received, call the callback.
    pool.connect((err, client, done) => {
      if (err) {
          console.error('Error starting transaction', err.stack);
          cb(err);
          return;
      }
      const shouldAbort = (err) => {
        if (err) {
          console.error('Error in transaction', err.stack);
          client.query('ROLLBACK', (err) => {
            // release the client back to the pool
            done()
            if (err) {
              console.error('Error rolling back client', err.stack)
            }
          })
          cb(err);
        }
        return !!err
      }

      client.on('notification', (msg) => {
        if (msg.channel === table && msg.payload === 'instance') {
          console.log('instance changed');
          pool.query(`SELECT * FROM ${table} LIMIT 1`, function (err, result) {
            cb(err, result.rows[0].id);
          });
        }
      })
      client.query(`LISTEN ${table}`)

      client.query('BEGIN', (err) => {
        if (shouldAbort(err)) return;

        client.query(`DELETE FROM ${table}`, (err, res) => {
          if (shouldAbort(err)) return;

          client.query(`INSERT INTO ${table}(id) VALUES ($1)`, [instanceId], (err, res) => {
            if (shouldAbort(err)) return;

            client.query(`NOTIFY ${table}, 'instance'`)

            client.query('COMMIT', (err) => {
              if (err) {
                console.error('Error committing transaction', err.stack)
              }
              done()
            })
          })
        })
      })
    })
  }

  var pgClient = initClient(config);



  var storage = {
    instance: {
      claim: function(instanceId, cb) {
        claimInstance(pgClient, "botkit_instance", instanceId, cb);
      }
    },
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
