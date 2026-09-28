"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";

import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

import {
  auth,
  db,
  googleProvider,
} from "./firebase";

type Profile = {
  people: number;
  days: number;
  children: boolean;
  olderAdults: boolean;
  pets: boolean;
  medications: boolean;
  mobility: boolean;
};

type Plan = {
  homeMeeting: string;
  neighborhoodMeeting: string;
  outOfAreaContact: string;
  evacuationRoute: string;
  shelterNotes: string;
  responsibilities: string;
};

type ChecklistItem = {
  id: string;
  category: string;
  label: string;
  detail?: string;
};

const defaultProfile: Profile = {
  people: 2,
  days: 3,
  children: false,
  olderAdults: false,
  pets: false,
  medications: false,
  mobility: false,
};

const defaultPlan: Plan = {
  homeMeeting: "",
  neighborhoodMeeting: "",
  outOfAreaContact: "",
  evacuationRoute: "",
  shelterNotes: "",
  responsibilities: "",
};

const baseItems: ChecklistItem[] = [
  {
    id: "water",
    category: "Water & food",
    label: "Stored drinking water",
  },
  {
    id: "food",
    category: "Water & food",
    label: "At least 3 days of nonperishable food",
  },
  {
    id: "opener",
    category: "Water & food",
    label: "Manual can opener",
  },
  {
    id: "radio",
    category: "Information",
    label: "Battery or hand-crank radio",
    detail: "Include a NOAA Weather Radio if available.",
  },
  {
    id: "alerts",
    category: "Information",
    label: "Local alerts enabled",
    detail: "Know which local agencies issue warnings where you live.",
  },
  {
    id: "light",
    category: "Home safety",
    label: "Flashlights and spare batteries",
  },
  {
    id: "firstaid",
    category: "Home safety",
    label: "First-aid kit",
  },
  {
    id: "whistle",
    category: "Home safety",
    label: "Whistle for signaling",
  },
  {
    id: "sanitation",
    category: "Home safety",
    label: "Sanitation supplies and trash bags",
  },
  {
    id: "cash",
    category: "Practical essentials",
    label: "Small amount of cash",
  },
  {
    id: "chargers",
    category: "Practical essentials",
    label: "Backup phone charging",
  },
  {
    id: "documents",
    category: "Practical essentials",
    label: "Protected copies of key documents",
  },
  {
    id: "maps",
    category: "Practical essentials",
    label: "Local paper map",
  },
];

function buildItems(profile: Profile): ChecklistItem[] {
  const extra: ChecklistItem[] = [];

  if (profile.children) {
    extra.push({
      id: "children",
      category: "Household needs",
      label: "Child-specific food, comfort, and care items",
    });
  }

  if (profile.olderAdults) {
    extra.push({
      id: "older",
      category: "Household needs",
      label: "Glasses, hearing-aid supplies, and support contacts",
    });
  }

  if (profile.pets) {
    extra.push({
      id: "pets",
      category: "Household needs",
      label: "Pet food, water, carrier, leash, and records",
    });
  }

  if (profile.medications) {
    extra.push({
      id: "meds",
      category: "Household needs",
      label: "Medication plan and current list",
      detail: "Ask a clinician or pharmacist how to prepare safely.",
    });
  }

  if (profile.mobility) {
    extra.push({
      id: "access",
      category: "Household needs",
      label: "Backup plan for mobility or powered medical equipment",
    });
  }

  return [...baseItems, ...extra];
}

export default function Home() {
  console.log("READYNEIGHBOR HOME COMPONENT RUNNING");
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [authError, setAuthError] = useState("");

  const [profile, setProfile] = useState<Profile>(defaultProfile);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [plan, setPlan] = useState<Plan>(defaultPlan);

  const [menuOpen, setMenuOpen] = useState(false);
  const [savedMessage, setSavedMessage] = useState("");

  const dataLoaded = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      async (firebaseUser) => {
        console.log("FIREBASE USER:", firebaseUser);
        setAuthLoading(true);
        setAuthError("");
        dataLoaded.current = false;

        if (!firebaseUser) {
          setUser(null);
          setProfile(defaultProfile);
          setChecked({});
          setPlan(defaultPlan);
          setDataLoading(false);
          setAuthLoading(false);
          return;
        }

        setUser(firebaseUser);
        setDataLoading(true);

        try {
          const userDataRef = doc(
            db,
            "users",
            firebaseUser.uid,
            "readyNeighbor",
            "main"
          );

          const snapshot = await getDoc(userDataRef);

          if (snapshot.exists()) {
            const data = snapshot.data();

            setProfile(data.profile ?? defaultProfile);
            setChecked(data.checked ?? {});
            setPlan(data.plan ?? defaultPlan);
          } else {
            setProfile(defaultProfile);
            setChecked({});
            setPlan(defaultPlan);

            await setDoc(userDataRef, {
              profile: defaultProfile,
              checked: {},
              plan: defaultPlan,
              email: firebaseUser.email ?? "",
              displayName: firebaseUser.displayName ?? "",
              photoURL: firebaseUser.photoURL ?? "",
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }

          dataLoaded.current = true;
        } catch (error) {
          console.error("Could not load ReadyNeighbor account:", error);

          setAuthError(
            "Your ReadyNeighbor information could not be loaded."
          );
        } finally {
          setDataLoading(false);
          setAuthLoading(false);
        }
      }
    );

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user || !dataLoaded.current) {
      return;
    }

    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
    }

    saveTimer.current = setTimeout(async () => {
      try {
        setSavedMessage("Saving...");

        const userDataRef = doc(
          db,
          "users",
          user.uid,
          "readyNeighbor",
          "main"
        );

        await setDoc(
          userDataRef,
          {
            profile,
            checked,
            plan,
            email: user.email ?? "",
            displayName: user.displayName ?? "",
            photoURL: user.photoURL ?? "",
            updatedAt: serverTimestamp(),
          },
          {
            merge: true,
          }
        );

        setSavedMessage("Saved to your account");

        window.setTimeout(() => {
          setSavedMessage("");
        }, 1800);
      } catch (error) {
        console.error("Could not save ReadyNeighbor data:", error);
        setSavedMessage("Could not save");
      }
    }, 500);

    return () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
      }
    };
  }, [user, profile, checked, plan]);

  const items = useMemo(() => buildItems(profile), [profile]);

  const completed = items.filter(
    (item) => checked[item.id]
  ).length;

  const progress =
    items.length > 0
      ? Math.round((completed / items.length) * 100)
      : 0;

  const waterGallons =
    Math.max(1, profile.people) *
    Math.max(1, profile.days);

  const categories = [
    ...new Set(items.map((item) => item.category)),
  ];

  function updateProfile<K extends keyof Profile>(
    key: K,
    value: Profile[K]
  ) {
    setProfile((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function updatePlan<K extends keyof Plan>(
    key: K,
    value: string
  ) {
    setPlan((current) => ({
      ...current,
      [key]: value,
    }));
  }

  async function handleGoogleSignIn() {
    try {
      setAuthError("");

      await signInWithPopup(auth, googleProvider);
    } catch (error: unknown) {
      console.error("Google sign-in error:", error);

      const firebaseError = error as {
        code?: string;
      };

      if (
        firebaseError.code ===
        "auth/popup-closed-by-user"
      ) {
        return;
      }

      if (
        firebaseError.code ===
        "auth/unauthorized-domain"
      ) {
        setAuthError(
          "This website domain must be added to Firebase Authorized domains."
        );
        return;
      }

      setAuthError(
        "Google sign-in could not be completed. Please try again."
      );
    }
  }

  async function handleSignOut() {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Sign-out error:", error);
    }
  }

  if (authLoading || dataLoading) {
    return (
      <main className="auth-page">
        <section className="auth-card">
          <div className="brand">
            <span className="brand-mark" aria-hidden="true">
              <span />
            </span>

            <span>ReadyNeighbor</span>
          </div>

          <h1>Loading your account...</h1>

          <p>
            Getting your private checklist and emergency plan ready.
          </p>
        </section>
      </main>
    );
  }
console.log("AUTH CHECK:", {
  user,
  authLoading
});
  if (!user) {
    return (
      <main className="auth-page">
        <section className="auth-card">
          <div className="brand">
            <span className="brand-mark" aria-hidden="true">
              <span />
            </span>

            <span>ReadyNeighbor</span>
          </div>

          <p className="eyebrow">
            Preparedness, made personal
          </p>

          <h1>
            Your preparedness
            <br />
            <em>starts here.</em>
          </h1>

          <p>
            Sign in with Google to create your private
            ReadyNeighbor account. Your checklist and emergency
            plan will be available whenever you sign back in.
          </p>

          <button
            className="button primary"
            type="button"
            onClick={handleGoogleSignIn}
          >
            Continue with Google
          </button>

          {authError && (
            <p className="auth-error" role="alert">
              {authError}
            </p>
          )}
        </section>
      </main>
    );
  }

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to main content
      </a>

      <header className="site-header">
        <a
          className="brand"
          href="#top"
          aria-label="ReadyNeighbor home"
        >
          <span className="brand-mark" aria-hidden="true">
            <span />
          </span>

          <span>ReadyNeighbor</span>
        </a>

        <button
          className="menu-button"
          type="button"
          aria-expanded={menuOpen}
          aria-controls="primary-navigation"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          <span aria-hidden="true">
            {menuOpen ? "×" : "☰"}
          </span>

          <span className="sr-only">
            {menuOpen ? "Close menu" : "Open menu"}
          </span>
        </button>

        <nav
          id="primary-navigation"
          className={menuOpen ? "nav open" : "nav"}
          aria-label="Primary navigation"
        >
          <a
            href="#essentials"
            onClick={() => setMenuOpen(false)}
          >
            Start here
          </a>

          <a
            href="#checklist"
            onClick={() => setMenuOpen(false)}
          >
            Checklist
          </a>

          <a
            href="#plan"
            onClick={() => setMenuOpen(false)}
          >
            My plan
          </a>

          <a
            href="#neighbors"
            onClick={() => setMenuOpen(false)}
          >
            Neighbors
          </a>

          <button
            type="button"
            className="text-button"
            onClick={handleSignOut}
          >
            Sign out
          </button>
        </nav>
      </header>

      <main id="main">
        <section className="hero" id="top">
          <div className="hero-copy">
            <p className="eyebrow">
              Preparedness, made neighborly
            </p>

            <h1>
              Small steps today.
              <br />
              <em>Steadier days ahead.</em>
            </h1>

            <p className="hero-intro">
              Build a practical household plan, gather what
              matters, and strengthen the connections close to
              home.
            </p>

            <div className="hero-actions">
              <a
                className="button primary"
                href="#checklist"
              >
                Build my checklist
                <span aria-hidden="true">→</span>
              </a>

              <a
                className="text-link"
                href="#essentials"
              >
                See the essentials
              </a>
            </div>

            <p className="privacy-note">
              <span aria-hidden="true">●</span>{" "}
              Your checklist and plan are saved to your account.
            </p>
          </div>

          <div
            className="hero-visual"
            aria-label="Illustration of homes connected in a resilient neighborhood"
            role="img"
          >
            <div className="sun" />
            <div className="cloud cloud-one" />
            <div className="cloud cloud-two" />
            <div className="hill hill-back" />
            <div className="hill hill-front" />

            <div className="house house-one">
              <span className="roof" />
              <span className="door" />
              <span className="window" />
            </div>

            <div className="house house-two">
              <span className="roof" />
              <span className="door" />
              <span className="window" />
            </div>

            <div className="house house-three">
              <span className="roof" />
              <span className="door" />
              <span className="window" />
            </div>

            <div className="path" />

            <div className="visual-card">
              <strong>Ready is a direction</strong>
              <span>Start with one useful step.</span>
            </div>
          </div>
        </section>

        <section
          className="signal-strip"
          aria-label="Core preparedness actions"
        >
          <div>
            <span>01</span>
            <strong>Know your risks</strong>
            <p>
              Learn the hazards and alerts where you live.
            </p>
          </div>

          <div>
            <span>02</span>
            <strong>Make a plan</strong>
            <p>
              Decide how you’ll connect, meet, and adapt.
            </p>
          </div>

          <div>
            <span>03</span>
            <strong>Gather essentials</strong>
            <p>
              Build supplies around your household’s needs.
            </p>
          </div>
        </section>

        <section
          className="section essentials"
          id="essentials"
        >
          <div className="section-heading">
            <p className="eyebrow">
              The calm-before checklist
            </p>

            <h2>Begin with the basics</h2>

            <p>
              Preparedness is easier when it is specific.
              These four moves cover the foundation.
            </p>
          </div>

          <div className="essentials-grid">
            <article className="feature-card feature-card-water">
              <span className="card-number">01</span>

              <div
                className="icon-drop"
                aria-hidden="true"
              >
                💧
              </div>

              <h3>Store water</h3>

              <p>
                Plan for at least one gallon per person per
                day for drinking and sanitation.
              </p>

              <a href="#checklist">
                Calculate your amount
                <span aria-hidden="true">↘</span>
              </a>
            </article>

            <article className="feature-card">
              <span className="card-number">02</span>

              <div
                className="icon-round"
                aria-hidden="true"
              >
                ⌁
              </div>

              <h3>Stay informed</h3>

              <p>
                Enable local alerts and keep a
                battery-powered or hand-crank radio available.
              </p>

              <a href="#sources">
                Why this matters
                <span aria-hidden="true">↘</span>
              </a>
            </article>

            <article className="feature-card">
              <span className="card-number">03</span>

              <div
                className="icon-round"
                aria-hidden="true"
              >
                ⌂
              </div>

              <h3>Choose meeting places</h3>

              <p>
                Pick one near home and another outside your
                neighborhood in case you separate.
              </p>

              <a href="#plan">
                Add them to your plan
                <span aria-hidden="true">↘</span>
              </a>
            </article>

            <article className="feature-card feature-card-coral">
              <span className="card-number">04</span>

              <div
                className="icon-round"
                aria-hidden="true"
              >
                ♡
              </div>

              <h3>Plan for real needs</h3>

              <p>
                Include medicines, mobility, children, older
                adults, pets, and power-dependent equipment.
              </p>

              <a href="#checklist">
                Personalize your list
                <span aria-hidden="true">↘</span>
              </a>
            </article>
          </div>
        </section>

        <section
          className="section tool-section"
          id="checklist"
        >
          <div className="section-heading split-heading">
            <div>
              <p className="eyebrow">
                Your household kit
              </p>

              <h2>A list that fits your life</h2>
            </div>

            <p>
              Choose what applies. Your list updates instantly
              and saves to your account.
            </p>
          </div>

          <div className="checklist-layout">
            <aside
              className="profile-panel"
              aria-labelledby="profile-title"
            >
              <h3 id="profile-title">
                Household profile
              </h3>

              <div className="number-row">
                <label htmlFor="people">
                  People
                </label>

                <input
                  id="people"
                  type="number"
                  min="1"
                  max="20"
                  value={profile.people}
                  onChange={(event) =>
                    updateProfile(
                      "people",
                      Math.min(
                        20,
                        Math.max(
                          1,
                          Number(event.target.value)
                        )
                      )
                    )
                  }
                />
              </div>

              <div className="number-row">
                <label htmlFor="days">
                  Days to plan for
                </label>

                <input
                  id="days"
                  type="number"
                  min="3"
                  max="14"
                  value={profile.days}
                  onChange={(event) =>
                    updateProfile(
                      "days",
                      Math.min(
                        14,
                        Math.max(
                          3,
                          Number(event.target.value)
                        )
                      )
                    )
                  }
                />
              </div>

              <fieldset>
                <legend>Include needs for</legend>

                {(
                  [
                    ["children", "Children"],
                    ["olderAdults", "Older adults"],
                    ["pets", "Pets"],
                    ["medications", "Medications"],
                    [
                      "mobility",
                      "Mobility or powered equipment",
                    ],
                  ] as [keyof Profile, string][]
                ).map(([key, label]) => (
                  <label
                    className="toggle-row"
                    key={key}
                  >
                    <span>{label}</span>

                    <input
                      type="checkbox"
                      checked={Boolean(profile[key])}
                      onChange={(event) =>
                        updateProfile(
                          key,
                          event.target.checked as never
                        )
                      }
                    />

                    <span
                      className="toggle"
                      aria-hidden="true"
                    />
                  </label>
                ))}
              </fieldset>

              <div
                className="water-result"
                aria-live="polite"
              >
                <span>Water starting point</span>

                <strong>
                  {waterGallons} gallons
                </strong>

                <small>
                  {profile.people}{" "}
                  {profile.people === 1
                    ? "person"
                    : "people"}{" "}
                  × {profile.days} days
                </small>
              </div>
            </aside>

            <div className="checklist-panel">
              <div className="progress-block">
                <div>
                  <strong>
                    {completed} of {items.length} ready
                  </strong>

                  <span>{progress}% complete</span>
                </div>

                <div
                  className="progress-track"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={progress}
                  aria-label="Checklist progress"
                >
                  <span
                    style={{
                      width: `${progress}%`,
                    }}
                  />
                </div>
              </div>

              {categories.map((category) => (
                <div
                  className="check-group"
                  key={category}
                >
                  <h3>{category}</h3>

                  {items
                    .filter(
                      (item) =>
                        item.category === category
                    )
                    .map((item) => (
                      <label
                        className="check-item"
                        key={item.id}
                      >
                        <input
                          type="checkbox"
                          checked={Boolean(
                            checked[item.id]
                          )}
                          onChange={(event) =>
                            setChecked((current) => ({
                              ...current,
                              [item.id]:
                                event.target.checked,
                            }))
                          }
                        />

                        <span
                          className="custom-check"
                          aria-hidden="true"
                        >
                          ✓
                        </span>

                        <span>
                          <strong>
                            {item.label}
                          </strong>

                          {item.detail && (
                            <small>
                              {item.detail}
                            </small>
                          )}
                        </span>
                      </label>
                    ))}
                </div>
              ))}

              <button
                className="button secondary"
                type="button"
                onClick={() => window.print()}
              >
                Print checklist
              </button>
            </div>
          </div>
        </section>

        <section
          className="section plan-section"
          id="plan"
        >
          <div className="plan-intro">
            <p className="eyebrow">
              Your emergency plan
            </p>

            <h2>
              Write it down.
              <br />
              Talk it through.
            </h2>

            <p>
              A useful plan answers where to meet, how to
              reconnect, and what each person will do. Use
              short, practical notes—avoid storing sensitive
              information.
            </p>

            <div className="plan-tip">
              <span aria-hidden="true">!</span>

              <p>
                <strong>Practice matters</strong>
                Review the plan together and update it when
                circumstances change.
              </p>
            </div>
          </div>

          <form
            className="plan-form"
            onSubmit={(event) =>
              event.preventDefault()
            }
          >
            <p className="local-badge">
              <span aria-hidden="true">●</span>{" "}
              Saved to your private account
            </p>

            <label>
              Meeting place near home

              <input
                value={plan.homeMeeting}
                onChange={(event) =>
                  updatePlan(
                    "homeMeeting",
                    event.target.value
                  )
                }
                placeholder="Example: the large tree across the street"
              />
            </label>

            <label>
              Meeting place outside the neighborhood

              <input
                value={plan.neighborhoodMeeting}
                onChange={(event) =>
                  updatePlan(
                    "neighborhoodMeeting",
                    event.target.value
                  )
                }
                placeholder="Example: community library entrance"
              />
            </label>

            <label>
              Out-of-area contact method

              <input
                value={plan.outOfAreaContact}
                onChange={(event) =>
                  updatePlan(
                    "outOfAreaContact",
                    event.target.value
                  )
                }
                placeholder="Name or nickname + preferred way to connect"
              />
            </label>

            <label>
              Evacuation route and backup

              <input
                value={plan.evacuationRoute}
                onChange={(event) =>
                  updatePlan(
                    "evacuationRoute",
                    event.target.value
                  )
                }
                placeholder="Primary route; backup route; transportation notes"
              />
            </label>

            <label>
              Shelter and access needs

              <textarea
                value={plan.shelterNotes}
                onChange={(event) =>
                  updatePlan(
                    "shelterNotes",
                    event.target.value
                  )
                }
                placeholder="Pets, mobility, medication, language, or power needs"
                rows={3}
              />
            </label>

            <label>
              Who handles what?

              <textarea
                value={plan.responsibilities}
                onChange={(event) =>
                  updatePlan(
                    "responsibilities",
                    event.target.value
                  )
                }
                placeholder="Example: grab kit; help children; check on neighbor"
                rows={3}
              />
            </label>

            <div className="form-actions">
              <button
                className="button primary"
                type="button"
                onClick={() => window.print()}
              >
                Print my plan
              </button>

              <button
                className="text-button"
                type="button"
                onClick={() => {
                  if (
                    window.confirm(
                      "Clear the plan saved to your account?"
                    )
                  ) {
                    setPlan(defaultPlan);
                  }
                }}
              >
                Clear plan
              </button>

              <span
                className="save-status"
                role="status"
              >
                {savedMessage}
              </span>
            </div>
          </form>
        </section>

        <section
          className="section neighbors"
          id="neighbors"
        >
          <div
            className="neighbors-visual"
            aria-hidden="true"
          >
            <div className="neighbor-circle circle-a">
              A
            </div>

            <div className="neighbor-circle circle-b">
              B
            </div>

            <div className="neighbor-circle circle-c">
              C
            </div>

            <div className="connection line-a" />
            <div className="connection line-b" />
            <div className="connection line-c" />
          </div>

          <div className="neighbors-copy">
            <p className="eyebrow">
              Resilience is a team sport
            </p>

            <h2>
              Know who you can count on—and who counts on you.
            </h2>

            <p>
              Community resilience grows through simple,
              respectful connections. Share only what people
              are comfortable sharing.
            </p>

            <ul>
              <li>
                <span>1</span>
                Exchange a reliable way to connect.
              </li>

              <li>
                <span>2</span>
                Discuss who may need extra help.
              </li>

              <li>
                <span>3</span>
                Choose a simple check-in approach.
              </li>
            </ul>
          </div>
        </section>

        <section
          className="section sources"
          id="sources"
        >
          <div className="section-heading">
            <p className="eyebrow">
              Trusted guidance
            </p>

            <h2>Sources & safety notes</h2>

            <p>
              ReadyNeighbor summarizes general U.S.
              preparedness guidance. In an emergency, follow
              instructions from local officials. For medical
              needs, consult a qualified professional.
            </p>
          </div>

          <div className="source-grid">
            <a
              href="https://www.ready.gov/kit"
              target="_blank"
              rel="noreferrer"
            >
              <span>Ready.gov</span>
              <strong>
                Build an Emergency Kit
              </strong>
              <small>
                Core supplies and household-specific needs ↗
              </small>
            </a>

            <a
              href="https://www.ready.gov/plan"
              target="_blank"
              rel="noreferrer"
            >
              <span>Ready.gov</span>
              <strong>Make a Plan</strong>
              <small>
                Communication, evacuation, and family planning ↗
              </small>
            </a>

            <a
              href="https://www.cdc.gov/water-emergency/about/index.html"
              target="_blank"
              rel="noreferrer"
            >
              <span>CDC</span>
              <strong>
                Emergency Water Safety
              </strong>
              <small>
                Safe water after an emergency ↗
              </small>
            </a>

            <a
              href="https://www.cdc.gov/natural-disasters/response/what-to-do-protect-yourself-during-a-power-outage.html"
              target="_blank"
              rel="noreferrer"
            >
              <span>CDC</span>
              <strong>
                Power Outage Safety
              </strong>
              <small>
                Food, water, medication, and generator safety ↗
              </small>
            </a>

            <a
              href="https://www.fema.gov/emergency-managers/national-preparedness/plan/resilience-guidance"
              target="_blank"
              rel="noreferrer"
            >
              <span>FEMA</span>
              <strong>
                National Resilience Guidance
              </strong>
              <small>
                Whole-community roles in resilience ↗
              </small>
            </a>
          </div>

          <p className="source-date">
            Sources reviewed August 20, 2026.
          </p>
        </section>
      </main>

      <footer>
        <a
          className="brand footer-brand"
          href="#top"
        >
          <span
            className="brand-mark"
            aria-hidden="true"
          >
            <span />
          </span>

          <span>ReadyNeighbor</span>
        </a>

        <p>
          Practical preparation for steadier households and
          stronger blocks.
        </p>

        <a href="#top">
          Back to top ↑
        </a>
      </footer>
    </>
  );
}