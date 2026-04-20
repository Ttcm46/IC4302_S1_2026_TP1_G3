import crypto from "crypto";
import redis from "redis";

async function RedisinitializeStore(host = "http://localhost:8080", database = "test") {
      const RDclient = redis.createClient({
        url: host,
        database: database
      });
      RDclient.on('error', err => console.log('Redis Client Error', err));
      RDclient.connect();
    return RDclient;
}

export { RedisinitializeStore };