import os

files = [
    "/Users/navjotsinghhundal/Desktop/_Active/Hilston New/blog-wye-valley.html",
    "/Users/navjotsinghhundal/Desktop/_Active/Hilston New/legal.html",
    "/Users/navjotsinghhundal/Desktop/_Active/Hilston New/about.html",
    "/Users/navjotsinghhundal/Desktop/_Active/Hilston New/blog-school-trip.html",
    "/Users/navjotsinghhundal/Desktop/_Active/Hilston New/blog-international-menu.html",
    "/Users/navjotsinghhundal/Desktop/_Active/Hilston New/index.html",
    "/Users/navjotsinghhundal/Desktop/_Active/Hilston New/blog-why-schools-book.html",
    "/Users/navjotsinghhundal/Desktop/_Active/Hilston New/accommodation.html",
    "/Users/navjotsinghhundal/Desktop/_Active/Hilston New/blog-accommodation.html",
    "/Users/navjotsinghhundal/Desktop/_Active/Hilston New/educational.html",
    "/Users/navjotsinghhundal/Desktop/_Active/Hilston New/blog-team-building.html",
    "/Users/navjotsinghhundal/Desktop/_Active/Hilston New/privacy.html",
    "/Users/navjotsinghhundal/Desktop/_Active/Hilston New/terms.html",
    "/Users/navjotsinghhundal/Desktop/_Active/Hilston New/blogs.html",
    "/Users/navjotsinghhundal/Desktop/_Active/Hilston New/visitors.html",
    "/Users/navjotsinghhundal/Desktop/_Active/Hilston New/event.html",
    "/Users/navjotsinghhundal/Desktop/_Active/Hilston New/contact.html",
]

marker = "Cookie preferences button"
count = 0

for f in files:
    content = open(f, encoding="utf-8").read()
    if marker in content:
        lines = content.splitlines()
        new_lines = [line for line in lines if marker not in line.strip() or "button id=" in line]
        removed = len(lines) - len(new_lines)
        if removed > 0:
            open(f, "w", encoding="utf-8").write("\n".join(new_lines))
            count += 1
            print("Fixed (" + str(removed) + " line removed): " + os.path.basename(f))
        else:
            print("No comment line found: " + os.path.basename(f))

print("Done. Fixed " + str(count) + " files.")
