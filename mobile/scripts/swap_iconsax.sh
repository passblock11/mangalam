#!/usr/bin/env bash
set -e
cd /Users/tejasborate/mangalam/mobile/lib/ui

# Ordered longest-first to avoid partial replacements.
# Format: MATERIAL_NAME|ICONSAX_NAME
mapping=(
  "account_balance_wallet_outlined|wallet"
  "add_circle_outline_rounded|add_circle"
  "arrow_downward_rounded|arrow_down"
  "arrow_upward_rounded|arrow_up"
  "auto_awesome_rounded|flash"
  "access_time_rounded|clock"
  "calendar_today_outlined|calendar"
  "chat_bubble_outline_rounded|message"
  "chat_bubble_outline|message"
  "chevron_right_rounded|arrow_right"
  "currency_rupee_rounded|wallet"
  "description_outlined|document_text"
  "error_outline_rounded|warning_2"
  "favorite_border_rounded|heart"
  "favorite_outline|heart"
  "format_quote_rounded|text_block"
  "help_outline_rounded|info_circle"
  "location_city_rounded|building"
  "more_vert_rounded|more"
  "people_outline_rounded|people"
  "person_outline_rounded|user"
  "phone_in_talk_outlined|call_calling"
  "phone_outlined|call"
  "refresh_rounded|refresh"
  "school_rounded|book_saved"
  "settings_outlined|setting"
  "star_outline_rounded|star"
  "translate_rounded|translate"
  "verified_rounded|verify"
  "workspace_premium_rounded|crown"
  "work_outline_rounded|briefcase"
  "arrow_back_rounded|arrow_left"
  "article_outlined|document_text"
  "calendar_today|calendar"
  "chat_rounded|message"
  "close_rounded|close_circle"
  "edit_rounded|edit"
  "favorite_rounded|heart"
  "favorite_border|heart"
  "group_rounded|profile_2user"
  "height_rounded|arrow_swap"
  "language_rounded|global"
  "more_vert|more"
  "person_outline|user"
  "send_rounded|send_1"
  "star_outline|star"
  "work_rounded|briefcase"
  "favorite|heart"
  "logout|logout"
  "message|message"
  "person|user"
  "refresh|refresh"
  "search|search_normal"
  "send|send_1"
  "star|star"
  "verified|verify"
  "circle|info_circle"
  "close|close_circle"
  "group|profile_2user"
  "phone|call"
  "place|location"
  "check|tick"
  "edit|edit"
  "more|more"
  "star|star"
  "user|user"
)

files=$(find . -name '*.dart' -type f)

for f in $files; do
  # Add import if file references Icons. and lacks the iconsax import.
  if grep -q "Icons\." "$f" && ! grep -q "package:iconsax_flutter" "$f"; then
    # Insert after first import line
    awk 'NR==1 && /^import/ {print; print "import '\''package:iconsax_flutter/iconsax_flutter.dart'\'';"; next} {print}' "$f" > "$f.tmp" && mv "$f.tmp" "$f"
  fi

  for pair in "${mapping[@]}"; do
    mat="${pair%%|*}"
    sax="${pair##*|}"
    # Replace Icons.<mat> (word boundary on the icon name start)
    sed -i '' "s/Icons\.${mat}/Iconsax.${sax}/g" "$f"
  done
done

echo "done"
