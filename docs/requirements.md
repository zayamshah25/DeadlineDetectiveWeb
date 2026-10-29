# Requirements — web application scope

MoSCoW: M = Must, S = Should, C = Could. Owner allocation below is **proposed**, not proof of completed work.

| ID | Functional requirement | Priority | Proposed owner |
|---|---|---|---|
| FR-01 | Student can create an assignment | M | Zayam |
| FR-02 | Student can view assignment list | M | Zayam |
| FR-03 | Student can edit an assignment | M | Amina |
| FR-04 | Student can delete an assignment | M | Amina |
| FR-05 | Student can mark assignment completed | M | Haseeb |
| FR-06 | Student can see deadline and priority | M | Haseeb |
| FR-07 | Student can search and filter assignments | S | Amina |
| FR-08 | Student can sort assignments | S | Amina |
| FR-09 | Student can view a study planner | S | Haseeb |
| FR-10 | Student can view progress/statistics | S | Zayam |
| FR-11 | Student can sign in to an account | C | Zayam |
| FR-12 | Student can switch theme | C | Haseeb |

## Measurable nonfunctional requirements (targets, not measured results)
| ID | Requirement | Priority | Proposed owner |
|---|---|---|---|
| NFR-01 | On a typical laptop, initial page loads within 3 seconds on localhost | S | Zayam |
| NFR-02 | CRUD API returns a response within 1 second for 100 saved tasks locally | S | Haseeb |
| NFR-03 | Task data remains after backend restart | M | Amina |
| NFR-04 | Text meets WCAG AA contrast target of at least 4.5:1 | S | Amina |

**Scope caveat:** These are web-specific requirements; the original course brief may still require mobile-specific compliance.
