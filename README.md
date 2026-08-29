# Biz Scout Pro

Build a full-stack AI-powered Business Lead Finder web application.

1. MAIN PURPOSE

The user should be able to enter:

- City / Location

- Business Category

- Minimum Google rating

- Maximum Google rating

Example:

- City: "Sri Hargobindpur"

- Category: "Fashion Shops"

- Minimum Rating: "3.0"

- Maximum Rating: "4.5"

The application should search for businesses matching the category and location, collect their Google Maps business information, strictly filter the results according to the user's rating range, and then find and verify the official Instagram profile for each business.

The final result should ONLY contain businesses for which ALL required information is available.

---

2. INPUT UI

Create a clean modern dashboard with these fields:

Search Configuration

City / Location

- Text input

- Example: "Sri Hargobindpur"

Business Category

- Text input

- Example: "Fashion Shops"

Minimum Rating

- Number input

- Default: "3.0"

Maximum Rating

- Number input

- Default: "4.5"

Search Businesses button

Also provide:

- Clear Search

- Export CSV

- Export JSON

- Copy Results

---

3. GOOGLE MAPS / BUSINESS SEARCH

Use a proper Google Maps / Google Places API integration through a secure backend.

IMPORTANT:

- Never expose API keys in frontend code.

- Store all API keys in environment variables/secrets.

- Perform API requests through backend/server functions.

Search for businesses using:

"category + city"

Example:

"Fashion Shops in Sri Hargobindpur"

Retrieve as many relevant businesses as the available API pagination allows.

Handle pagination automatically and continue fetching available result pages.

Do NOT intentionally return only the first few businesses.

Remove duplicate businesses using:

- Google Place ID when available

- Otherwise normalized business name + phone + address

---

4. REQUIRED GOOGLE BUSINESS DATA

For every discovered business, attempt to retrieve:

- Business Name

- Phone Number

- Rating

- Number of Ratings / Reviews

- Address

- Google Maps URL

- Business Category

The core required fields for the final output are:

1. Business Name

2. Mobile Number

3. Rating

4. Number of Ratings

5. Official Instagram URL

---

5. STRICT RATING FILTER

Apply the user's rating range AFTER collecting the Google business data.

Example:

Minimum = "3.0"

Maximum = "4.5"

Only accept:

"3.0 <= rating <= 4.5"

So:

- 2.9 → reject

- 3.0 → accept

- 3.7 → accept

- 4.5 → accept

- 4.6 → reject

- 5.0 → reject

The maximum rating must be respected exactly.

Do NOT hardcode 4.5. The user should be able to change the maximum rating.

---

6. COMPLETE-DATA FILTER

This is extremely important.

A business should NOT appear in the final results unless ALL required information is available.

Required:

- Business Name ✓

- Mobile Number ✓

- Valid Rating ✓

- Number of Ratings ✓

- Official Instagram URL ✓

If any required field is missing:

DO NOT include that business in the final result.

For example:

Business has:

- Name ✓

- Phone ✓

- Rating ✓

- Reviews ✓

- Instagram ✗

→ Reject the business.

Do NOT show incomplete businesses in the final table.

---

7. INSTAGRAM FINDING SYSTEM

After Google business filtering is complete, process each eligible business individually to find its official Instagram profile.

For each business dynamically generate this search prompt:

"Find the official Instagram profile handle of "BUSINESS_NAME" in CITY (a CATEGORY business). Return the exact instagram.com URL."

Example:

"Find the official Instagram profile handle of "ABC Fashion Store" in Sri Hargobindpur (a Fashion Shops business). Return the exact instagram.com URL."

Replace:

- "BUSINESS_NAME" with actual business name

- "CITY" with user-entered city

- "CATEGORY" with user-entered category

Do NOT use the literal words "BUSINESS_NAME", "CITY", or "CATEGORY" in the actual search.

---

8. INSTAGRAM VERIFICATION

Do not blindly accept the first Instagram result.

The system should try to determine whether the Instagram account actually belongs to the business.

Use signals such as:

- Business name similarity

- Location/city similarity

- Category/business type similarity

- Website links

- Phone/contact information if available

- Instagram profile name/handle

- Bio mentioning the business/location

Prefer an official business account over:

- Fan pages

- Personal accounts

- Unrelated accounts

- Aggregator pages

- Duplicate accounts

The final Instagram field must contain the exact profile URL, for example:

"https://www.instagram.com/businesshandle/"

Normalize Instagram URLs and remove tracking parameters.

If no reliable official Instagram profile can be found, reject that business from the final output.

---

9. INSTAGRAM SEARCH FALLBACK

If the primary search method does not find Instagram, use a secondary web search method.

Try queries such as:

""BUSINESS NAME" "CITY" Instagram"

and:

"site:instagram.com "BUSINESS NAME" "CITY""

Then verify the result against the business information.

Do not invent Instagram handles.

Never generate a fake Instagram URL.

---

10. PROCESSING PIPELINE

The application must follow this exact sequence:

STEP 1

User enters:

City + Category + Min Rating + Max Rating

STEP 2

Search Google Maps / Places.

STEP 3

Collect business information.

STEP 4

Remove duplicates.

STEP 5

Apply rating filter.

STEP 6

Check required Google business fields.

STEP 7

For every remaining business, search for official Instagram.

STEP 8

Verify Instagram belongs to that business.

STEP 9

Remove businesses without a verified Instagram profile.

STEP 10

Return ONLY complete verified leads.

---

11. RESULT TABLE

Show the final results in a clean table with EXACTLY these primary columns:

| Business Name | Mobile Number | Rating | Number of Ratings | Instagram |

Instagram should be clickable.

Example:

Business Name| Mobile Number| Rating| Number of Ratings| Instagram

ABC Fashion Store| +91XXXXXXXXXX| 4.2| 183| https://www.instagram.com/abc.../

Do not show incomplete businesses.

---

12. OPTIONAL EXTRA DATA

The UI can have an expandable "More Details" section containing:

- Address

- Category

- Google Maps URL

- Place ID

- Instagram handle

- Instagram verification status

- Search status

But the main result table must remain:

Business Name | Mobile Number | Rating | Number of Ratings | Instagram

---

13. SEARCH PROGRESS

Because Instagram searching can take time, show live progress.

Example:

"Searching Google Maps..."

"Found 42 businesses"

"Filtering ratings..."

"32 businesses match rating range"

"Finding Instagram profiles..."

"Instagram verification: 18 / 32"

"Final verified leads: 14"

Use a progress bar and status indicator.

---

14. ERROR HANDLING

Handle:

- Google API errors

- Rate limits

- No businesses found

- Invalid city

- Invalid category

- Invalid rating range

- Missing phone number

- Missing rating

- Instagram not found

- Instagram verification failure

- API timeout

If no businesses satisfy ALL requirements, show:

"No complete verified businesses found for this search."

Do not show partial results as final results.

---

15. API / BACKEND ARCHITECTURE

Use a secure backend architecture.

Recommended:

- React frontend

- Supabase backend/database

- Supabase Edge Functions/server-side API calls

- Environment variables for API keys

Do not put API keys directly into React/browser JavaScript.

Create separate backend functions for:

1. Business search

2. Business detail retrieval

3. Instagram search

4. Instagram verification

5. Result filtering

6. Export

---

16. DATABASE

Create a database table for search results.

Suggested fields:

- id

- search_id

- business_name

- phone

- rating

- rating_count

- address

- category

- city

- google_maps_url

- place_id

- instagram_url

- instagram_handle

- instagram_verified

- status

- created_at

Store search history so the user can reopen previous searches.

---

17. EXPORT

Add:

Export CSV

CSV columns must be:

"Business Name, Mobile Number, Rating, Number of Ratings, Instagram"

Export JSON

Use:

[

  {

    "business_name": "ABC Fashion Store",

    "mobile_number": "+91XXXXXXXXXX",

    "rating": 4.2,

    "number_of_ratings": 183,

    "instagram": "https://www.instagram.com/abc/"

  }

]

---

18. UI DESIGN

Make the dashboard modern, clean and professional.

Top section:

AI Business Lead Finder

Subtitle:

"Find verified local businesses with Google ratings and official Instagram profiles."

Search card:

City | Category | Min Rating | Max Rating | Search

Below it:

- Search progress

- Results count

- Results table

- Export buttons

- Search history

Use responsive design so it works properly on mobile and desktop.

---

19. IMPORTANT RULES

1. Never fabricate business information.

2. Never fabricate phone numbers.

3. Never fabricate ratings.

4. Never fabricate review counts.

5. Never fabricate Instagram handles.

6. Never create an Instagram URL unless a real profile has been found.

7. Only show businesses within the requested rating range.

8. Only show businesses having ALL required fields.

9. Remove duplicate businesses.

10. Verify Instagram profiles before accepting them.

11. Do not expose API keys.

12. Respect API rate limits and terms of service.

13. Use pagination wherever the API supports it.

14. The final result must contain ONLY complete verified leads.

Build the application end-to-end, including frontend, backend functions, database schema, API integration structure, filtering logic, Instagram search workflow, progress UI, result table, CSV/JSON export, and error handling.

Before finishing, test the complete workflow with:

City: "Sri Hargobindpur"

Category: "Fashion Shops"

Minimum Rating: "3.0"

Maximum Rating: "4.5"

I need backend also

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://biz-instalink.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/65ce74b1-7f21-4ce9-a597-4102b7ddc311).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
