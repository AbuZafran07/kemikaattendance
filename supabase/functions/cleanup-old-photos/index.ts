import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

const RETENTION_DAYS = 90;

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  const preflightResponse = handleCorsPreflightRequest(req);
  if (preflightResponse) return preflightResponse;

  const origin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.warn('Cleanup attempt without authentication');
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create client with user's token to verify their identity and role
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Get the authenticated user
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    
    if (authError || !user) {
      console.warn('Invalid authentication token');
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify admin role using the has_role function
    const { data: isAdmin, error: roleError } = await supabaseAuth.rpc('has_role', {
      _user_id: user.id,
      _role: 'admin'
    });

    if (roleError || !isAdmin) {
      console.warn(`Non-admin user ${user.id} attempted cleanup operation`);
      return new Response(
        JSON.stringify({ error: 'Forbidden - Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Admin user ${user.id} initiated photo cleanup`);
    
    // Use service role client for actual cleanup operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);
    
    console.log(`Starting cleanup of photos older than ${RETENTION_DAYS} days (before ${cutoffDate.toISOString()})`);

    // Get attendance records with photos older than retention period
    const { data: oldRecords, error: fetchError } = await supabase
      .from('attendance')
      .select('id, check_in_photo_url, check_out_photo_url, check_in_time')
      .lt('check_in_time', cutoffDate.toISOString())
      .or('check_in_photo_url.not.is.null,check_out_photo_url.not.is.null');

    if (fetchError) {
      console.error('Error fetching old records:', fetchError);
      throw fetchError;
    }

    if (!oldRecords || oldRecords.length === 0) {
      console.log('No old photos to clean up');
      return new Response(
        JSON.stringify({ message: 'No old photos to clean up', deletedCount: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${oldRecords.length} records with photos to clean up`);

    // Collect all photo paths to delete
    const photoPaths: string[] = [];
    const recordIds: string[] = [];

    for (const record of oldRecords) {
      if (record.check_in_photo_url) {
        // Extract path from URL or use directly if it's already a path
        const path = extractPathFromUrl(record.check_in_photo_url);
        if (path) photoPaths.push(path);
      }
      if (record.check_out_photo_url) {
        const path = extractPathFromUrl(record.check_out_photo_url);
        if (path) photoPaths.push(path);
      }
      recordIds.push(record.id);
    }

    console.log(`Attempting to delete ${photoPaths.length} photos`);

    // Delete photos from storage in batches
    let deletedCount = 0;
    const batchSize = 100;
    
    for (let i = 0; i < photoPaths.length; i += batchSize) {
      const batch = photoPaths.slice(i, i + batchSize);
      const { error: deleteError } = await supabase.storage
        .from('attendance-photos')
        .remove(batch);

      if (deleteError) {
        console.error(`Error deleting batch ${i / batchSize + 1}:`, deleteError);
      } else {
        deletedCount += batch.length;
        console.log(`Deleted batch ${i / batchSize + 1}: ${batch.length} photos`);
      }
    }

    // Clear photo URLs from attendance records
    const { error: updateError } = await supabase
      .from('attendance')
      .update({
        check_in_photo_url: null,
        check_out_photo_url: null
      })
      .in('id', recordIds);

    if (updateError) {
      console.error('Error updating attendance records:', updateError);
    } else {
      console.log(`Cleared photo URLs from ${recordIds.length} attendance records`);
    }

    console.log(`Cleanup complete by admin ${user.id}. Deleted ${deletedCount} photos from ${recordIds.length} records`);

    return new Response(
      JSON.stringify({
        message: 'Cleanup completed successfully',
        deletedPhotos: deletedCount,
        updatedRecords: recordIds.length,
        retentionDays: RETENTION_DAYS
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Cleanup error:', error);
    return new Response(
      JSON.stringify({ error: 'An error occurred during cleanup' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function extractPathFromUrl(urlOrPath: string): string | null {
  if (!urlOrPath) return null;
  
  // If it's already a path (not a full URL), return it
  if (!urlOrPath.startsWith('http')) {
    return urlOrPath;
  }
  
  // Extract path from signed URL or public URL
  try {
    const url = new URL(urlOrPath);
    const pathMatch = url.pathname.match(/\/storage\/v1\/object\/(?:sign|public)\/attendance-photos\/(.+)/);
    if (pathMatch) {
      return decodeURIComponent(pathMatch[1].split('?')[0]);
    }
  } catch {
    console.warn('Could not parse URL:', urlOrPath);
  }
  
  return null;
}
