/* Replace with your SQL commands */
/* Replace with your SQL commands */
-- Table: water.sessions

-- DROP TABLE water.sessions;

CREATE TABLE water.data_store
(
    id character varying COLLATE pg_catalog."default",
    value character varying COLLATE pg_catalog."default",
    stored bigint NOT NULL,
    ttl bigint NOT NULL,
    PRIMARY KEY(id)
)
WITH (
    OIDS = FALSE
)
TABLESPACE pg_default;
