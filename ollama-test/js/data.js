const OLLAMA = 'http://2.25.164.172:11434', MODEL = 'aluminati-bot';

const db = {
    events: [
        {id:1,name:'Annual Network Gala',       date:'2025-09-12',location:'Grand Hotel, London',capacity:250,status:'Confirmed'},
        {id:2,name:'Summer Career Fair',         date:'2025-07-18',location:'Virtual',            capacity:400,status:'Planning'},
        {id:3,name:'Homecoming Weekend',         date:'2025-10-24',location:'Main Campus',        capacity:500,status:'Planning'},
        {id:4,name:'Regional Meetup – New York',date:'2025-08-05',location:'Tribeca, New York', capacity: 80,status:'Confirmed'},
    ],
    members: [
        {id:1,name:'Sarah Chen',      email:'s.chen@example.com',  year:'2010',chapter:'London',  status:'Active'},
        {id:2,name:'James Okafor',    email:'j.okafor@example.com',year:'2005',chapter:'Lagos',   status:'Active'},
        {id:3,name:'Emma Richardson', email:'e.rich@example.com',  year:'2018',chapter:'New York',status:'Inactive'},
        {id:4,name:'David Park',      email:'d.park@example.com',  year:'2015',chapter:'Seoul',   status:'Active'},
        {id:5,name:'Aisha Patel',     email:'a.patel@example.com', year:'2020',chapter:'Mumbai',  status:'Active'},
    ],
    nextEv: 5, nextMb: 6,
};

let view = 'dashboard', aiOpen = false, hist = [], busy = false, rdr = null, qpGone = false;
let evTimer = null, mbTimer = null;
let evEditId = null, mbEditId = null;

const TITLES = {
    dashboard: 'Dashboard',
    events:    'Events',
    members:   'Members',
    comms:     'Communications',
    reports:   'Reports',
};

const PROMPTS = {
    dashboard: [
        ["📅 Create an event — I'll ask for what's missing", "I want to create a networking event."],
        ["👤 Add a member — I'll ask for what's missing",    "I want to add a new member."],
    ],
    events: [
        ['📅 Create a new event',            "I want to create a new event."],
        ['✅ Confirm the Summer Career Fair', "Mark the Summer Career Fair as Confirmed."],
        ['🌍 Add a virtual fundraiser',       "Create a virtual fundraising event called 'Alumni Giving Day' on 2025-11-01, capacity 1000."],
    ],
    members: [
        ['👤 Add a new member', "I want to add a new member to the network."],
        ['🔄 Reactivate Emma',  "Reactivate Emma Richardson — change her status to Active."],
    ],
    comms: [
        ['✉️ Draft a re-engagement email', "Draft a short re-engagement email for members who haven't attended an event in over a year."],
    ],
    reports: [
        ['📊 Summarise the current data', "Give me a summary of the current events and members."],
    ],
};
