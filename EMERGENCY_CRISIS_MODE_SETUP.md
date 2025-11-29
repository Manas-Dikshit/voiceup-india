# Emergency Crisis Mode - Setup & Deployment Guide

## Overview
This document outlines the setup steps to deploy the Emergency Crisis Mode feature, which transforms VoiceUp into a real-time disaster response system.

## System Architecture

### Components Created

#### 1. Database Schema (Migration)
- **File**: `supabase/migrations/20251129120000_emergency_crisis_mode.sql`
- **Tables**: 7 new tables for emergency incident management
- **Status**: Migration file created, not yet applied

#### 2. Serverless Functions (Deno/Edge Functions)
- **emergency-detect**: Life-threat detection with AI scoring
- **emergency-prioritize**: Multi-factor incident prioritization
- **emergency-assign-resources**: Distance-based resource matching
- **emergency-send-alerts**: Alert broadcasting to citizens

#### 3. UI Components (React/TypeScript)
- **EmergencyCrisisMode.tsx**: Main dashboard (5-tab interface)
- **IncidentPrioritizer.tsx**: Incident list with selection
- **ResourceDispatcher.tsx**: Resource deployment status
- **CrisisMap.tsx**: Map visualization with markers
- **AlertBroadcaster.tsx**: Emergency alert broadcasting UI
- **PredictedZonesViewer.tsx**: Risk zone predictions

#### 4. Routing & Navigation
- Route added: `/ministry/emergency` → EmergencyCrisisMode component
- Navigation link added to MinistryHeader
- Lazy-loaded in App.tsx for performance

## Deployment Steps

### Step 1: Apply Database Migration

```bash
# Ensure you're in the project root with supabase CLI installed
cd c:\Users\ashis\OneDrive\Documents\Desktop\voiceup-india

# Link your Supabase project (if not already linked)
supabase link

# Apply the migration
supabase migration up

# Verify migration applied
supabase db pull
```

**Migration Contents:**
- Creates 4 PostgreSQL ENUMs (emergency_type, incident_severity, resource_type, deployment_status)
- Creates 7 tables:
  - `emergency_incidents` - Core incident tracking
  - `crisis_zones` - Predicted high-risk areas
  - `emergency_alerts` - Broadcast alerts to citizens
  - `emergency_resources` - Registry of rescue resources
  - `resource_deployments` - Resource assignments to incidents
  - `emergency_officer_assignments` - Officer dispatching
  - `crisis_activity_log` - Audit trail
- Creates indexes for fast querying on location, status, severity
- Sets up Row-Level Security (RLS) policies
- Creates audit triggers for logging

### Step 2: Deploy Serverless Functions

```bash
# Deploy each function to Supabase Edge Functions

supabase functions deploy emergency-detect
supabase functions deploy emergency-prioritize
supabase functions deploy emergency-assign-resources
supabase functions deploy emergency-send-alerts

# Verify deployment
supabase functions list
```

**Function Details:**

#### emergency-detect
- **Input**: `{ problemId: string }`
- **Output**: `{ isEmergency: boolean, emergencyType: string, severity: string, lifeThreateningScore: number, confidence: number, reasoning: string }`
- **Logic**: Rule-based keyword matching for life-threatening detection
- **Auto-action**: Creates emergency_incidents record if score > 0.3

#### emergency-prioritize
- **Input**: None (queries all active incidents)
- **Output**: Prioritized incident array with ranking (0-100 score)
- **Logic**: Multi-factor scoring (severity + population + recency + type + life-threat)
- **Auto-action**: Logs assignments to crisis_activity_log

#### emergency-assign-resources
- **Input**: `{ incidentId: string }`
- **Output**: Top 5 resources with distance, ETA, priority score
- **Logic**: Type matching + haversine distance calculation + capacity consideration
- **Auto-action**: Creates resource_deployments records with status='pending'

#### emergency-send-alerts
- **Input**: `{ incidentId: string, alertType: string, message: string, radiusKm: number }`
- **Output**: Alert record with recipient count
- **Logic**: Localized templates + radius-based user discovery
- **Auto-action**: Creates emergency_alerts record, logs to crisis_activity_log

### Step 3: Update Type Definitions

The Supabase types need to be refreshed to include the new emergency tables:

```bash
# Regenerate Supabase client types
supabase gen types typescript --local > src/integrations/supabase/types.ts
```

**If types still missing:**
1. Create `src/integrations/supabase/emergency-types.ts` with manual type definitions
2. Import from this file when needed
3. Cast queries with `as EmergencyIncident[]` if necessary

### Step 4: Test the System

1. **Test Emergency Detection**:
   - Create a problem with keywords like "flood", "fire", "cyclone", "earthquake", "medical"
   - Check `emergency_incidents` table for auto-creation
   - Verify severity and life_threatening flags

2. **Test Prioritization**:
   - Call `emergency-prioritize` function manually
   - Verify incidents sorted by priority score
   - Check crisis_activity_log for audit trail

3. **Test Resource Assignment**:
   - Create sample resources in `emergency_resources` table
   - Call `emergency-assign-resources` for an incident
   - Verify `resource_deployments` records created

4. **Test Alert Broadcasting**:
   - Call `emergency-send-alerts` with test incident
   - Check `emergency_alerts` table for record
   - Verify recipients_count calculated

### Step 5: Navigate to Emergency Mode

1. Sign in as ministry user
2. In the header, click "Emergency" link (red alert icon)
3. Should see:
   - Key metrics dashboard (critical incidents, deployed resources, etc.)
   - 5 tabs: Incidents | Map | Resources | Zones | Alerts
   - Real-time updates (5-30 second refetch intervals)

## Feature Reference

### Dashboard Metrics
- **Critical Incidents**: Count of severity='critical' incidents
- **Total Incidents**: All active incidents
- **Deployed Resources**: Resources with status='en_route' or 'arrived'
- **Risk Zones**: Count of predicted high-risk zones

### Incidents Tab
- Displays prioritized incident list
- Sorted by priority score descending
- Click incident to select
- Shows: title, type, severity, location, population affected, AI confidence
- Life-threatening incidents highlighted
- Action: "Assign Resources" button

### Map Tab
- Visual representation of incidents and zones
- Shows incident markers and zone overlays
- Displays incident list sidebar with legends
- Severity distribution histogram
- **Note**: Production version uses Mapbox/Leaflet for interactive maps

### Resources Tab
- Shows all deployed resources
- Status cards (Assigned, En Route, Arrived, Completed)
- Distance, ETA, and status progression
- Summary stats grid
- Alerts for long ETAs

### Risk Zones Tab
- Lists predicted high-risk areas
- Shows risk level (1-10) with progress bar
- Forecast confidence percentage
- Estimated population at risk
- **Note**: Data requires weather API integration for predictions

### Alerts Tab
- Broadcast emergency alerts to citizens
- Template-based messages (evacuation, shelter, warning, medical)
- Customizable message and radius
- Recipient count estimate
- Broadcast history with status tracking

## Production Checklist

- [ ] Database migration applied
- [ ] 4 serverless functions deployed
- [ ] Types refreshed/updated
- [ ] Emergency route accessible in navigation
- [ ] Test with sample incident data
- [ ] Configure notification channels (push/SMS/email)
- [ ] Integrate weather API for zone predictions
- [ ] Integrate real map service (Mapbox/Leaflet)
- [ ] Set up officer/resource database records
- [ ] Configure RLS policies for production users
- [ ] Add incident status workflow (reported → under_review → active → resolved)
- [ ] Implement real-time WebSocket updates (optional)

## Troubleshooting

### Missing Emergency Tables in Queries
**Issue**: Type error "emergency_incidents" is not a valid table
**Solution**: 
1. Ensure migration has been applied: `supabase migration list`
2. Refresh types: `supabase gen types typescript --local`
3. Restart TypeScript server in VS Code

### Functions Not Deploying
**Issue**: `supabase functions deploy` fails
**Solution**:
1. Check function file syntax: `deno check supabase/functions/emergency-detect/index.ts`
2. Verify `.env.local` has SUPABASE_URL and SUPABASE_ANON_KEY
3. Check Supabase project has Edge Functions enabled

### No Data in Emergency Dashboard
**Issue**: Dashboard shows 0 incidents/zones
**Solution**:
1. Manually insert test data into emergency_incidents table
2. Call emergency-detect function on existing problems
3. Check RLS policies allow queries from current user

### Alerts Not Broadcasting
**Issue**: Alert broadcast fails silently
**Solution**:
1. Verify function logs: `supabase functions logs emergency-send-alerts`
2. Check emergency_resources table has available resources
3. Ensure recipient calculation radius is reasonable (5-50 km)
4. Verify incident has valid latitude/longitude coordinates

## Future Enhancements

1. **Weather API Integration**
   - Connect OpenWeatherMap or local weather provider
   - Auto-populate crisis_zones based on forecasts
   - Update risk levels dynamically

2. **Real-time Notifications**
   - Firebase Cloud Messaging (push)
   - Twilio (SMS)
   - SendGrid (email)
   - SMS fallback for critical alerts

3. **Advanced Resource Matching**
   - Skill-based officer assignment
   - Vehicle capacity optimization
   - Traffic-aware ETA calculations
   - Multi-resource incident coordination

4. **Interactive Mapping**
   - Mapbox GL or Leaflet integration
   - Real-time marker clustering
   - Heatmap visualization
   - Route planning for resources

5. **Predictive Analytics**
   - ML model for incident prediction
   - Historical pattern analysis
   - Resource demand forecasting

6. **Mobile App Integration**
   - Officer/volunteer mobile app
   - Real-time task assignment
   - Photo/video incident documentation

## File Locations Reference

```
supabase/
  migrations/
    20251129120000_emergency_crisis_mode.sql
  functions/
    emergency-detect/index.ts
    emergency-prioritize/index.ts
    emergency-assign-resources/index.ts
    emergency-send-alerts/index.ts

src/
  pages/
    ministry/
      EmergencyCrisisMode.tsx
  components/
    emergency/
      IncidentPrioritizer.tsx
      ResourceDispatcher.tsx
      CrisisMap.tsx
      AlertBroadcaster.tsx
      PredictedZonesViewer.tsx

App.tsx (route added)
components/ministry/MinistryHeader.tsx (navigation link added)
```

## Support & Documentation

For additional help:
1. Check Supabase documentation: https://supabase.com/docs
2. Review emergency function code comments
3. Check crisis_activity_log for detailed action audit trail
4. Test functions individually before integration testing

---
**Last Updated**: 2024
**Version**: 1.0
**Status**: Ready for Migration & Deployment
