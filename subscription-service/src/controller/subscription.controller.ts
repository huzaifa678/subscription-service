import { Controller, Get, Post, Patch, Param, Body } from '@nestjs/common';
import { SubscriptionService } from '@service/subscription.service';
import { CreateSubscriptionInput } from '@model/dtos/create-subscription.dto';
import { UpdateSubscriptionInput } from '@model/dtos/update-subscription.dto';

@Controller('/')
export class SubscriptionController {
  constructor(private readonly service: SubscriptionService) {}

  @Get(':id')
  getById(@Param('id') id: string) {
    return this.service.findById(id);
  }

  @Post()
  create(@Body() body: CreateSubscriptionInput) {
    return this.service.create(body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: UpdateSubscriptionInput) {
    return this.service.update(id, body);
  }
}
