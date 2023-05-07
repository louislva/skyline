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

create table "user"
(
    id         serial
        primary key
        unique,
    did        text                                         not null
        unique,
    created_on timestamp with time zone default now()       not null,
    handle     text                                         not null,
    config     jsonb                    default '{}'::jsonb not null
);

create table user_visit
(
    id            serial
        primary key
        unique,
    "user"        int               not null
        constraint user_visit_user_id_fk
            references "user"
            on update cascade on delete cascade,
    created_on    timestamp with time zone default now() not null,
    posted_config jsonb             not null
);