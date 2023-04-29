create table shared_custom_timeline
(
    id                serial
        primary key
        unique,
    key               text                                   not null
        unique,
    config            jsonb                                  not null,
    created_on        timestamp with time zone default now() not null,
    created_by_handle text                                   not null
);

alter table shared_custom_timeline
    add installs int default 0 not null;

alter table shared_custom_timeline
    add created_by_did text;

alter table shared_custom_timeline
    alter column config drop not null;

alter table shared_custom_timeline
    add config_new jsonb;
