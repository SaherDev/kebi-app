import { Module } from '@nestjs/common';
import { KebiModule } from '../kebi/kebi.module';
import { CuratorGuard } from '../common/guards/curator.guard';
import { KnowledgeController } from './knowledge.controller';
import { KnowledgeService } from './knowledge.service';

@Module({
  imports: [KebiModule],
  controllers: [KnowledgeController],
  providers: [KnowledgeService, CuratorGuard],
})
export class KnowledgeModule {}
