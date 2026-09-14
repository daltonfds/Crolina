import {createClient} from '@supabase/supabase-js';
export const supabase=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_PUBLISHABLE_KEY);
export async function authUser(req,_,next){const h=req.headers.authorization||'';if(h.startsWith('Bearer ')){const {data}=await supabase.auth.getUser(h.slice(7));if(data?.user)req.user=data.user}next()}
