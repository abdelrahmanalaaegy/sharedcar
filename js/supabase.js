const SB_URL = "https://owzaevvsvwufozynzvin.supabase.co"; 
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im93emFldnZzdnd1Zm96eW56dmluIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU1MDQ4NTgsImV4cCI6MjEwMTA4MDg1OH0.LRd_ekWBrk_BWDPv1PSmpSD9RygerdeeUCHUOQlwukQ";

const sb = supabase.createClient(SB_URL, SB_KEY);
window.sb = sb;
window.SB_URL = SB_URL;
window.SB_KEY = SB_KEY;
