const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkUsage(user) {
    if (user.user_metadata && user.user_metadata.is_super_user === true) {
        console.log(`Super user detected: ${user.email}. Skipping usage check.`);
        return { success: true };
    }

    const { data: config, error: configError } = await supabase
        .from('app_config')
        .select('config_value')
        .eq('config_key', 'monthly_request_limit')
        .single();

    if (configError) throw new Error('Could not retrieve app configuration.');
    const monthlyLimit = config.config_value;

    let { data: usage } = await supabase
        .from('user_usage')
        .select('*')
        .eq('user_id', user.id)
        .single();
    
    if (!usage) {
        const { error: insertError } = await supabase
            .from('user_usage')
            .insert({ user_id: user.id, monthly_requests: 1, last_reset_date: new Date().toISOString() });
        if(insertError) throw new Error('Failed to create user usage record.');
        return { success: true };
    }

    const lastReset = new Date(usage.last_reset_date);
    const now = new Date();
    if (now.getMonth() !== lastReset.getMonth() || now.getFullYear() !== lastReset.getFullYear()) {
        const { error: resetError } = await supabase
            .from('user_usage')
            .update({ monthly_requests: 1, last_reset_date: now.toISOString() })
            .eq('user_id', user.id);
        if(resetError) throw new Error('Failed to reset monthly usage.');
        return { success: true };
    }

    if (usage.monthly_requests >= monthlyLimit) {
        throw new Error('QUOTA_EXCEEDED');
    }

    const { error: incrementError } = await supabase
        .rpc('increment_user_requests', { user_id_param: user.id }); 

    if (incrementError) throw new Error('Failed to increment user usage.');

    return { success: true };
}

module.exports = { checkUsage };