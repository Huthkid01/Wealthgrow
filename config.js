// Production Configuration File
// Replace these values with your actual production credentials

const CONFIG = {
    SUPABASE: {
        URL: 'https://btbhlfjpgntpngzhxzrz.supabase.co',
        ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ0YmhsZmpwZ250cG5nemh4enJ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc1ODcwMzgsImV4cCI6MjA4MzE2MzAzOH0.CEga4626XGUctkweQ46KsvL1kFeUJJ_BgneisAnRAwI'
    },
    APP: {
        NAME: 'Wealth Grow',
        VERSION: '1.0.0',
        ENVIRONMENT: 'production'
    }
};

// For production, these should be loaded from environment variables:
// const CONFIG = {
//     SUPABASE: {
//         URL: process.env.SUPABASE_URL,
//         ANON_KEY: process.env.SUPABASE_ANON_KEY
//     }
// };
