import { DISCIPLINE_IDS } from '@/lib/disciplines';

/** Extra project fields captured per discipline (stored on Project entity). */
export const DISCIPLINE_SETUP_FIELD_DEFAULTS = {
  access_estimated_doors: '',
  access_reader_technology: '',
  access_head_end_notes: '',
  access_fire_interface_notes: '',
  access_compliance_notes: '',
  video_vms_platform: '',
  video_retention_days: '',
  video_resolution_target: '',
  video_poe_notes: '',
  video_coverage_notes: '',
  video_lighting_cyber_notes: '',
  av_primary_spaces: '',
  av_display_standard: '',
  av_control_platform: '',
  av_audio_video_notes: '',
  lv_mdf_location: '',
  lv_idf_quantity: '',
  lv_cable_media: 'Cat6A',
  lv_pathway_type: '',
  lv_testing_standard: 'TIA-568',
};

export function isFireAlarmDiscipline(id) {
  return id === DISCIPLINE_IDS.FIRE_ALARM;
}
