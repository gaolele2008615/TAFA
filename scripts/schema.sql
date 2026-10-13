CREATE TABLE IF NOT EXISTS tafa_visitors(id text PRIMARY KEY,name text NOT NULL DEFAULT '');
CREATE TABLE IF NOT EXISTS tafa_messages(
 id serial PRIMARY KEY,visitor text NOT NULL REFERENCES tafa_visitors(id) ON DELETE CASCADE,
 name text NOT NULL,body text NOT NULL CHECK(char_length(body) BETWEEN 1 AND 500),
 created timestamptz NOT NULL DEFAULT now(),day date NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Shanghai')::date,
 request_id text NOT NULL,UNIQUE(visitor,request_id));
CREATE INDEX IF NOT EXISTS tafa_message_day ON tafa_messages(visitor,day);
CREATE TABLE IF NOT EXISTS tafa_likes(message integer REFERENCES tafa_messages(id) ON DELETE CASCADE,visitor text REFERENCES tafa_visitors(id) ON DELETE CASCADE,PRIMARY KEY(message,visitor));
CREATE TABLE IF NOT EXISTS tafa_version(id integer PRIMARY KEY,value bigint NOT NULL);
INSERT INTO tafa_version VALUES(1,0) ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION tafa_set_name(v text,n text) RETURNS text LANGUAGE plpgsql AS $$
BEGIN
 PERFORM 1 FROM tafa_visitors WHERE id=v FOR UPDATE;
 IF EXISTS(SELECT 1 FROM tafa_messages WHERE visitor=v) THEN RETURN 'name_locked'; END IF;
 UPDATE tafa_visitors SET name=n WHERE id=v;
 UPDATE tafa_version SET value=value+1 WHERE id=1;
 RETURN 'ok';
END $$;

CREATE OR REPLACE FUNCTION tafa_post(v text,b text,k text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE n text;
BEGIN
 SELECT name INTO n FROM tafa_visitors WHERE id=v FOR UPDATE;
 IF n IS NULL OR n='' THEN RETURN 'name_required'; END IF;
 IF EXISTS(SELECT 1 FROM tafa_messages WHERE visitor=v AND request_id=k) THEN RETURN 'ok'; END IF;
 IF (SELECT count(*) FROM tafa_messages WHERE visitor=v AND day=(now() AT TIME ZONE 'Asia/Shanghai')::date)>=2 THEN RETURN 'daily_limit'; END IF;
 INSERT INTO tafa_messages(visitor,name,body,request_id) VALUES(v,n,b,k);
 UPDATE tafa_version SET value=value+1 WHERE id=1;
 RETURN 'ok';
END $$;

CREATE OR REPLACE FUNCTION tafa_like(v text,m integer) RETURNS text LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM tafa_messages WHERE id=m) THEN RETURN 'missing'; END IF;
 INSERT INTO tafa_likes(message,visitor) VALUES(m,v) ON CONFLICT DO NOTHING;
 IF NOT FOUND THEN RETURN 'already_liked'; END IF;
 UPDATE tafa_version SET value=value+1 WHERE id=1;
 RETURN 'ok';
END $$;
