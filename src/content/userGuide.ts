/**
 * Content of the in-app User Guide (page /user-guide and its PDF).
 * Text supports **bold**. Screenshots live in /public/guide and show made-up demo data only.
 */
import type { LucideIcon } from "lucide-react";
import {
  BarChart3, CalendarRange, Clock3, DoorOpen, HelpCircle, History, LayoutDashboard, LogIn,
  PanelLeft, Settings, ShieldCheck, Sparkles, UserCog, Users,
} from "lucide-react";

/** The guide as a PDF, printed from the reading view (static file in /public). */
export const USER_GUIDE_PDF = "/uniguard-user-guide.pdf";

export type GuideRole = "Admin" | "Scheduler" | "Viewer";

export type GuideBlock =
  | { kind: "p"; text: string }
  | { kind: "h"; text: string }
  | { kind: "list"; items: string[] }
  | { kind: "steps"; items: string[] }
  | { kind: "table"; head: string[]; rows: string[][] }
  | { kind: "img"; src: string; caption: string }
  | { kind: "tip"; text: string };

export interface GuideSection {
  id: string;
  title: string;
  icon: LucideIcon;
  roles: GuideRole[];
  summary: string;
  blocks: GuideBlock[];
}

const ALL: GuideRole[] = ["Admin", "Scheduler", "Viewer"];
const EDITORS: GuideRole[] = ["Admin", "Scheduler"];
const ADMIN: GuideRole[] = ["Admin"];
const img = (name: string, caption: string): GuideBlock => ({ kind: "img", src: `/guide/${name}.png`, caption });

export const QUICK_START = [
  "Add rooms",
  "Add people",
  "Set time slots",
  "Create an exam period",
  "Generate the schedule",
  "Check it",
  "Export & email staff",
];

export const GUIDE_SECTIONS: GuideSection[] = [
  {
    id: "welcome",
    title: "Welcome",
    icon: ShieldCheck,
    roles: ALL,
    summary: "What Uni-Guard does and what each role can do.",
    blocks: [
      { kind: "p", text: "Uni-Guard plans who supervises each exam room. It matches **people** (chief invigilators and invigilators) to **rooms** in **time slots**, fairly and without clashes." },
      { kind: "h", text: "Words used in this guide" },
      { kind: "list", items: [
        "**Exam period**: one exam season, for example \"Fall 2026 Finals\". Each period has its own schedule. People, rooms and time slots are shared by every period.",
        "**Chief invigilator**: the person in charge of a room.",
        "**Invigilator**: a supervisor in the room.",
        "**Duty / session**: one sitting at one date and time.",
      ] },
      { kind: "h", text: "What each role can do" },
      { kind: "table", head: ["Can…", "Admin", "Scheduler", "Viewer"], rows: [
        ["See dashboard, people, rooms, time slots, timeline, assignments, reports", "Yes", "Yes", "Yes"],
        ["Export PDF and Excel", "Yes", "Yes", "Yes"],
        ["Add and edit people, rooms, time slots and assignments", "Yes", "Yes", "No"],
        ["Use the Scheduler and email schedules", "Yes", "Yes", "No"],
        ["See the Emails page", "Yes", "Yes", "No"],
        ["Change university settings and scheduling rules", "Yes", "No", "No"],
        ["Manage users and see the Activity log", "Yes", "No", "No"],
      ] },
      { kind: "tip", text: "Everyone can change their own password and two-step sign-in, and open this guide from **User Guide** in the sidebar." },
    ],
  },
  {
    id: "sign-in",
    title: "Signing in",
    icon: LogIn,
    roles: ALL,
    summary: "Password, Microsoft or Google, two-step code, invitations.",
    blocks: [
      { kind: "p", text: "Open the Uni-Guard link your university gave you and sign in with your email and password." },
      img("login", "The sign-in page"),
      { kind: "list", items: [
        "**Email** and **Password**: your account details. The eye button shows or hides the password.",
        "**Sign in**: opens your dashboard.",
        "**Forgot password?**: type your email and you get a link to choose a new password.",
        "**Sign in with Microsoft / Google**: shown when your university switched it on.",
      ] },
      { kind: "h", text: "Two-step sign-in" },
      { kind: "p", text: "If it is on for your account, type the 6-digit code from your authenticator app (for example Google Authenticator) and press **Verify and sign in**. Lost your phone? Press **Lost your phone? Use a recovery code**." },
      { kind: "h", text: "First time? Accept your invitation" },
      { kind: "p", text: "Open the link in the invitation email, choose a password, type it twice and press **Save password**. If the admin gave you a temporary password instead, sign in with it; Uni-Guard then asks you to choose your own." },
      { kind: "tip", text: "After too many wrong passwords the account locks for a short time. Wait, or ask your admin to press **Unlock** on the Users page." },
    ],
  },
  {
    id: "layout",
    title: "The screen layout",
    icon: PanelLeft,
    roles: ALL,
    summary: "Sidebar, exam period selector, account menu.",
    blocks: [
      { kind: "p", text: "Every page has the same frame: the menu on the left, a bar on top, and the page itself. You only see the pages your role allows." },
      { kind: "h", text: "Top bar, from left to right" },
      { kind: "list", items: [
        "**Menu button**: folds or opens the sidebar.",
        "**Exam period selector**: the most important control. Dashboard, Scheduler, Timeline, Assignments and Reports all show the period chosen here.",
        "**+ (New exam period)**: type a **Name** (for example \"Fall 2026\") and an optional **Description**, then **Create period**.",
        "**Envelope (Email schedules)**: emails every assigned person their own duties for this period. Only new or changed schedules are sent.",
        "**Moon / sun**: dark or light mode.",
        "**Your name**: **Settings**, **My account & security**, **Log out**.",
      ] },
      img("new-period", "New exam period, opened with the + button"),
      img("account-menu", "The account menu, opened from your name"),
      { kind: "tip", text: "On a phone or tablet the sidebar opens from the menu button, the exam period sits on its own row, and tables turn into cards." },
    ],
  },
  {
    id: "dashboard",
    title: "Dashboard",
    icon: LayoutDashboard,
    roles: ALL,
    summary: "The selected exam period at a glance.",
    blocks: [
      { kind: "p", text: "The Dashboard shows the selected exam period at a glance and tells you what to do next." },
      img("dashboard", "The Dashboard"),
      { kind: "list", items: [
        "**Get started** (only while something is missing): Add exam rooms, Add people, Set time slots, Create the schedule.",
        "**Number cards**: chief invigilators, invigilators, exam rooms, room assignments.",
        "**Needs attention**: rooms missing a chief or invigilators. **Fix in assignments** opens them.",
        "**Upcoming exams**: the next exam rooms. **Timeline** opens the full list.",
        "**Open assignments** (top right): jumps to the Assignments list.",
      ] },
    ],
  },
  {
    id: "people",
    title: "People",
    icon: Users,
    roles: ALL,
    summary: "Everyone who can supervise exams, leave dates, Excel import.",
    blocks: [
      { kind: "p", text: "People is the list of everyone who can supervise exams. It is shared by every exam period; **Duties this period** counts the selected period only." },
      img("people", "The People page"),
      { kind: "list", items: [
        "**Everyone / Chief invigilators / Invigilators**: show one group.",
        "**Add person** and **Import from Excel**: add one person or many.",
        "**Search**, **Department** filter and **Sort** (name, most or fewest duties, department).",
        "Click a name to see every duty of that person. The row menu has **Edit, leave dates** and **Delete**.",
      ] },
      { kind: "h", text: "Add or edit a person" },
      img("person-dialog", "Add person"),
      { kind: "table", head: ["Field", "What to enter"], rows: [
        ["Role", "Chief invigilator (can cover several rooms at once) or Invigilator (one room)"],
        ["Full name, Department", "Required"],
        ["Email", "Optional. Needed to email them their schedule"],
        ["Available days", "The weekdays they can work. **Sun–Thu** and **Every day** fill it in one click"],
        ["Gender", "Only needed for women-only or men-only halls"],
        ["Subjects taught", "Course codes, for example MATH101. They never supervise these exams"],
      ] },
      { kind: "tip", text: "**Leave dates**: open **Edit**, pick a start and end date, add a reason and press **Add leave**. The Scheduler will not use the person on those days." },
      { kind: "h", text: "Import from Excel" },
      img("import-dialog", "Import people from Excel"),
      { kind: "steps", items: [
        "Press **Import from Excel**, then **Download template**.",
        "Fill one row per person. Only the first sheet is read.",
        "Drop the file in the window. Nothing is saved yet: each row shows ready, renamed or a problem.",
        "Choose what happens to existing names: **Add with a number** or **Skip it**.",
        "Press **Import**. Rows with problems are left out.",
      ] },
    ],
  },
  {
    id: "rooms",
    title: "Rooms",
    icon: DoorOpen,
    roles: ALL,
    summary: "Halls and labs, seats and staffing needs.",
    blocks: [
      { kind: "p", text: "Rooms lists every exam hall and lab with its seats and staffing needs. Rooms are shared by every exam period." },
      img("rooms", "The Rooms page"),
      { kind: "list", items: [
        "**Add room**, **Import from Excel** (same steps as people), **Search**, **Room size** and **Hall** filters, **Sort**.",
        "Each row: seats, size and staff needed, with **Edit** and **Delete**.",
      ] },
      img("room-dialog", "Add room"),
      { kind: "table", head: ["Field", "What to enter"], rows: [
        ["Room name", "For example \"Hall A\""],
        ["Capacity", "Number of seats"],
        ["Minimum invigilators", "Invigilators the room always needs, besides the chief"],
        ["Room type", "Small, Medium or Large"],
        ["Hall gender", "Mixed (anyone), Male hall or Female hall"],
      ] },
    ],
  },
  {
    id: "time-slots",
    title: "Time slots",
    icon: Clock3,
    roles: ALL,
    summary: "The exam sittings of a day.",
    blocks: [
      { kind: "p", text: "Time slots are the exam sittings of a day, for example Morning 09:00–11:00. They are shared by every exam period, and several exams can run in the same slot in different rooms." },
      img("time-slots", "The Time Slots page"),
      { kind: "list", items: [
        "**Add time slot**: optional name, start and end.",
        "**The exam day**: a picture of the day, so gaps and overlaps are easy to see.",
        "**Edit**, **Deactivate** (stop offering it, old exams stay), **Activate**, **Delete** (refused while an exam uses it).",
      ] },
    ],
  },
  {
    id: "scheduler",
    title: "Scheduler",
    icon: Sparkles,
    roles: EDITORS,
    summary: "Build the schedule: generate, adjust, save.",
    blocks: [
      { kind: "p", text: "The Scheduler fills one **date + time slot** at a time with fair, clash-free staff." },
      img("scheduler", "The Scheduler: date, time slot, rooms, and one card per exam room"),
      { kind: "h", text: "Build one slot" },
      { kind: "steps", items: [
        "Check the exam period in the top bar.",
        "Pick the **date**, then the **time slot** (Morning, Noon…).",
        "Open the rooms button (for example **4 of 9 rooms**) and tick the rooms that have an exam.",
        "Press **Generate schedule**. Each room gets a chief and its invigilators.",
        "Adjust what you like, then press **Save** (Ctrl+S). Nothing is stored before you save.",
      ] },
      { kind: "h", text: "Each room card" },
      { kind: "list", items: [
        "Click a person to change them. The list only shows people who are free, available, not on leave, allowed in that hall and not teaching that subject.",
        "Drag the dots beside an invigilator onto another to swap them. The bin removes an extra position.",
        "**Add Invigilator** adds a position. **Unlocked / Locked**: locked rooms stay as they are when you generate again. The eraser empties the room.",
        "Badges: **Valid**, **Shared** (one chief for several rooms), **Incomplete**, **Conflict**. The number after a name (3×) is that person's duties this period.",
      ] },
      { kind: "h", text: "Other buttons" },
      { kind: "list", items: [
        "**Add room**, **Undo**, **Reset slot** (back to the last generated version), **Regenerate unlocked**.",
        "**Bulk schedule**: upload a whole timetable (Excel or CSV, also Banner, PeopleSoft and Odoo exports) and generate every slot at once.",
        "**Export PDF**: see Timeline & export.",
      ] },
      img("bulk-schedule", "Bulk schedule"),
    ],
  },
  {
    id: "timeline",
    title: "Timeline, assignments & export",
    icon: CalendarRange,
    roles: ALL,
    summary: "Check, fix and print the schedule.",
    blocks: [
      { kind: "p", text: "**Timeline** shows every exam of the period, day by day. It is the easiest page for checking and sharing." },
      img("timeline", "The Timeline"),
      { kind: "list", items: [
        "**Search** staff, subject, room or day. **Only rooms that need staff** shows the gaps.",
        "**Jump to day**, **Expand all**, **Collapse all**, **Edit in Scheduler**.",
      ] },
      { kind: "p", text: "**Assignments** is the same data as one list, for fixing single rooms: filters, **Add assignment** by hand, **Edit** and **Delete** per row, and **Delete all** of a period (you type its name to confirm)." },
      img("assignments", "The Assignments list"),
      { kind: "h", text: "Export" },
      img("export", "Export"),
      { kind: "table", head: ["Choice", "Options"], rows: [
        ["Format", "PDF (printable) or Excel (schedule + workload)"],
        ["Scope", "Single day or Full period"],
      ] },
      { kind: "tip", text: "The PDF header and signatures come from **Settings → University**." },
    ],
  },
  {
    id: "reports",
    title: "Reports",
    icon: BarChart3,
    roles: ALL,
    summary: "Overview, workload & fairness, hours for finance.",
    blocks: [
      { kind: "p", text: "Reports shows how the selected exam period looks, in three tabs." },
      { kind: "h", text: "Overview" },
      img("reports-overview", "Reports: Overview"),
      { kind: "p", text: "Exam days, exam rooms, staff used and how many rooms are fully staffed, with exam rooms per day." },
      { kind: "h", text: "Workload & fairness" },
      img("reports-fairness", "Reports: Workload & fairness"),
      { kind: "p", text: "How evenly hours are spread, who has the most hours, who has none yet, and hours per department." },
      { kind: "h", text: "Hours per person" },
      img("reports-hours", "Reports: Hours per person"),
      { kind: "p", text: "Sessions, rooms, days and hours for each person. **Export hours (Excel)** downloads it for finance." },
      { kind: "tip", text: "A session is one sitting. A chief covering two rooms at the same time works one session." },
    ],
  },
  {
    id: "users",
    title: "Users & roles",
    icon: UserCog,
    roles: ADMIN,
    summary: "Who can sign in, invitations, unlock, reset.",
    blocks: [
      { kind: "p", text: "Users lists who can sign in. This is separate from People: a person in People does not need an account." },
      img("users", "The Users page"),
      { kind: "steps", items: [
        "Press **Add user**, type the email and an optional name, and pick **Admin**, **Scheduler** or **Viewer**.",
        "Choose **Send an invitation email** (recommended) or a temporary password you give them yourself.",
        "Press **Add and invite**. You can also copy the invitation link.",
      ] },
      { kind: "table", head: ["Icon", "What it does"], rows: [
        ["Paper plane", "Sends a new invitation link"],
        ["Open lock", "Unlocks a locked account"],
        ["Shield", "Removes two-step sign-in (lost phone)"],
        ["Pencil", "Change name or role, or disable the account"],
        ["Key", "Sets a new temporary password and signs them out everywhere"],
        ["Bin", "Deletes the user"],
      ] },
    ],
  },
  {
    id: "activity",
    title: "Activity & emails",
    icon: History,
    roles: EDITORS,
    summary: "Who did what, and every email sent.",
    blocks: [
      { kind: "p", text: "**Activity** (admins) records sign-ins and every change. Entries cannot be edited or deleted. Filter by text, user, type, result and date, and **Export CSV**." },
      img("activity", "The Activity log"),
      { kind: "p", text: "**Emails** (admins and schedulers) lists every email: waiting, sent, failed, or replaced by a newer version. Use **Send again** or **Send failed again** for failed schedule emails." },
      img("emails", "The Emails page"),
    ],
  },
  {
    id: "settings",
    title: "Settings",
    icon: Settings,
    roles: ADMIN,
    summary: "University details, scheduling rules, Microsoft sign-in.",
    blocks: [
      { kind: "p", text: "Admins change university settings for everyone. Changes stay on screen until you press **Save**; **Discard** undoes them." },
      img("settings-university", "Settings: University"),
      { kind: "list", items: [
        "**Name and logo**: shown in the sidebar, sign-in page and browser tab.",
        "**Exported documents**: university and faculty printed on every PDF, plus the footer signatures, with a live preview.",
      ] },
      { kind: "h", text: "Scheduling rules" },
      img("settings-rules", "Settings: Scheduling rules"),
      { kind: "table", head: ["Rule", "Meaning (0 = no limit)"], rows: [
        ["Rooms one chief can cover at the same time", "1 = one room each; 2 or more allows a shared chief"],
        ["Students per invigilator", "Big rooms get more invigilators automatically"],
        ["Duty sessions per person per day", "Most sittings one person can have on the same day"],
        ["Duty sessions per person per exam period", "Most sittings one person can have in the whole exam period"],
        ["Minimum break between two sessions", "Minutes of rest between two sittings of the same person"],
      ] },
      { kind: "tip", text: "**Sign-in options**: type your university's Microsoft tenant id (from IT) so staff can use **Sign in with Microsoft**." },
    ],
  },
  {
    id: "account",
    title: "Your account",
    icon: ShieldCheck,
    roles: ALL,
    summary: "Password, two-step sign-in, sign out everywhere.",
    blocks: [
      { kind: "p", text: "Open it from your name → **My account & security**." },
      img("settings-account", "Settings: My account"),
      { kind: "list", items: [
        "**Change password**: current password, then the new one twice. Other devices are signed out.",
        "**Sign out of all devices**: for a lost device or a shared computer.",
        "**Connected accounts** (when Microsoft or Google sign-in is on): sign in without a password.",
      ] },
      { kind: "h", text: "Two-step sign-in" },
      { kind: "steps", items: [
        "Press **Set up two-step sign-in** and type your password.",
        "Scan the code with Google Authenticator, Microsoft Authenticator, Authy or 1Password.",
        "Type the 6-digit code and press **Switch on**.",
        "Save your recovery codes, then press **I have saved them**.",
      ] },
    ],
  },
  {
    id: "faq",
    title: "Common questions",
    icon: HelpCircle,
    roles: ALL,
    summary: "Quick fixes for everyday problems.",
    blocks: [
      { kind: "table", head: ["Problem", "What to do"], rows: [
        ["A person never appears in the list", "Check their available days, leave, hall gender and subjects. They may also have reached a limit in Settings"],
        ["A room shows Incomplete", "Not enough free people. Add people, relax a limit, or pick someone by hand"],
        ["A room shows Conflict", "A rule is broken, for example one person in two rooms. Pick someone else"],
        ["My Scheduler changes disappeared", "You left before pressing Save. Save each slot (Ctrl+S)"],
        ["Generate again changed rooms I liked", "Lock those rooms, then use Regenerate unlocked"],
        ["A staff member got no email", "Check their email in People, then the Emails page"],
        ["I see the wrong exams", "Check the exam period in the top bar"],
        ["I lost my authenticator phone", "Use a recovery code, or ask an admin to remove two-step sign-in"],
      ] },
    ],
  },
];
